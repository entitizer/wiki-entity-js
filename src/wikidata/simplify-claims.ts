import type {
  WikidataEntityClaims,
  WikidataGlobeCoordinateValue,
  WikidataProperty,
  WikidataPropertyValue,
  WikidataQuantityValue,
  WikidataRank,
  WikidataTimeValue
} from "../types";
import type { RawClaim, RawSnak } from "./raw-types";

export interface SimplifyClaimsOptions {
  /**
   * Keep statements Wikidata marks as deprecated (known wrong or superseded).
   * Default: `false`.
   */
  keepDeprecated?: boolean;
}

const RANKS = new Set<WikidataRank>(["preferred", "normal", "deprecated"]);

/** Simplify an entity's raw `claims` object. */
export function simplifyClaims(
  claims: Record<string, RawClaim[]> | null | undefined,
  options: SimplifyClaimsOptions = {}
): WikidataEntityClaims {
  const simpleClaims: WikidataEntityClaims = {};
  if (!claims) return simpleClaims;

  for (const id of Object.keys(claims)) {
    const propClaims = claims[id];
    if (!Array.isArray(propClaims)) continue;
    const prop = simplifyPropertyClaims(propClaims, id, options);
    if (prop.values.length > 0) simpleClaims[id] = prop;
  }
  return simpleClaims;
}

/** Simplify the claim array of a single property, e.g. `entity.claims.P569`. */
export function simplifyPropertyClaims(
  propClaims: readonly RawClaim[],
  id: string,
  options: SimplifyClaimsOptions = {}
): WikidataProperty {
  const values: WikidataPropertyValue[] = [];

  for (const claim of propClaims) {
    if (!options.keepDeprecated && claim?.rank === "deprecated") continue;
    const value = simplifyClaim(claim, options);
    if (value) values.push(value);
  }

  // Preferred statements first: they are Wikidata's "use this one" marker,
  // and callers overwhelmingly read `values[0]`.
  values.sort((a, b) => rankWeight(b.rank) - rankWeight(a.rank));

  return { id, values };
}

function rankWeight(rank: WikidataRank | undefined): number {
  if (rank === "preferred") return 2;
  if (rank === "deprecated") return 0;
  return 1;
}

/** Simplify a single claim, e.g. `entity.claims.P569[0]`. Returns `null` when the claim carries no value. */
export function simplifyClaim(
  claim: RawClaim | null | undefined,
  options: SimplifyClaimsOptions = {}
): WikidataPropertyValue | null {
  const mainsnak = claim?.mainsnak;
  // `novalue`/`somevalue` snaks carry no datavalue at all.
  if (!mainsnak || !mainsnak.datavalue) return null;

  const { datatype, datavalue } = mainsnak;
  if (datavalue.value === null || datavalue.value === undefined) return null;

  const simplified = simplifyDataValue(datavalue.type, datavalue.value);
  if (!simplified) return null;

  const result: WikidataPropertyValue = {
    datatype: datatype ?? datavalue.type ?? "unknown",
    value: simplified.value,
    qualifiers: simplifyClaims(toQualifierClaims(claim?.qualifiers), options)
  };

  if (simplified.value_string !== undefined) {
    result.value_string = simplified.value_string;
  }
  if (claim?.rank && RANKS.has(claim.rank as WikidataRank)) {
    result.rank = claim.rank as WikidataRank;
  }

  return result;
}

interface SimplifiedDataValue {
  value: WikidataPropertyValue["value"];
  value_string?: string;
}

/**
 * Dispatch on the *datavalue* type rather than the property datatype: it covers
 * every current and future datatype (lexemes, entity schemas, geo shapes, …)
 * with the same handful of shapes.
 */
function simplifyDataValue(
  type: string | undefined,
  raw: unknown
): SimplifiedDataValue | null {
  switch (type) {
    case "string":
      return typeof raw === "string" ? { value: raw } : null;

    case "wikibase-entityid": {
      const id = entityIdOf(raw);
      return id ? { value: id } : null;
    }

    case "monolingualtext": {
      const text = (raw as { text?: unknown }).text;
      return typeof text === "string" ? { value: text } : null;
    }

    case "time": {
      const value = raw as WikidataTimeValue;
      if (typeof value.time !== "string") return null;
      return { value, value_string: stringifyTime(value) };
    }

    case "quantity": {
      const value = raw as WikidataQuantityValue;
      const amount = Number.parseFloat(value.amount);
      if (!Number.isFinite(amount)) return null;
      return { value, value_string: String(amount) };
    }

    case "globecoordinate": {
      const value = raw as WikidataGlobeCoordinateValue;
      if (
        typeof value.latitude !== "number" ||
        typeof value.longitude !== "number"
      ) {
        return null;
      }
      return { value, value_string: stringifyCoordinates(value) };
    }

    default:
      // Unknown datavalue shape: keep primitives, drop objects we cannot render.
      if (typeof raw === "string" || typeof raw === "number") {
        return { value: raw };
      }
      return null;
  }
}

function entityIdOf(raw: unknown): string | null {
  const value = raw as {
    id?: unknown;
    "entity-type"?: unknown;
    "numeric-id"?: unknown;
  };
  if (typeof value.id === "string") return value.id;
  // Pre-2015 dumps only carry `entity-type` + `numeric-id`.
  const prefix =
    value["entity-type"] === "item"
      ? "Q"
      : value["entity-type"] === "property"
        ? "P"
        : null;
  if (prefix && typeof value["numeric-id"] === "number") {
    return `${prefix}${value["numeric-id"]}`;
  }
  return null;
}

function toQualifierClaims(
  qualifiers: Record<string, RawSnak[]> | null | undefined
): Record<string, RawClaim[]> | null {
  if (!qualifiers) return null;
  const claims: Record<string, RawClaim[]> = {};
  for (const property of Object.keys(qualifiers)) {
    const snaks = qualifiers[property];
    if (!Array.isArray(snaks)) continue;
    claims[property] = snaks.map((snak) => ({ mainsnak: snak }));
  }
  return claims;
}

/** Drop trailing zeros of a fixed-point rendering without eating integer digits. */
function trimTrailingZeros(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

export function stringifyCoordinates(
  value: Pick<WikidataGlobeCoordinateValue, "latitude" | "longitude">
): string {
  return `${trimTrailingZeros(value.latitude, 4)},${trimTrailingZeros(
    value.longitude,
    4
  )}`;
}

/**
 * Render a Wikidata time value at its stated precision.
 *
 * Wikidata precisions: 9 = year, 10 = month, 11 = day, 12+ = hour or finer.
 * Years are signed, so BCE dates keep their leading `-`.
 */
export function stringifyTime(value: WikidataTimeValue): string {
  const { time, precision } = value;
  // Coarser than a year (decade, century, millennium…): no useful rendering.
  if (typeof precision !== "number" || precision < 9) return time;

  const isBce = time.startsWith("-");
  // Strip the leading sign, which is always present ("+1879-03-14T00:00:00Z").
  let date = /^[+-]/.test(time) ? time.slice(1) : time;

  if (precision < 12) {
    date = date.split("T")[0] ?? date;
    if (precision === 10) {
      date = date.split("-").slice(0, 2).join("-");
    } else if (precision === 9) {
      date = date.split("-")[0] ?? date;
    }
  }

  return isBce ? `-${date}` : date;
}
