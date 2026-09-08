import { COUNTRIES } from "../data";
import type { WikiEntity } from "../types";
import { uniq } from "../utils";

/**
 * Properties carrying an entity's country, most specific first:
 * P17 country, P27 country of citizenship, P495 country of origin,
 * P1532 country for sport.
 */
const COUNTRY_PROPERTIES = ["P17", "P27", "P495", "P1532"] as const;

/**
 * Lowercase ISO 3166-1 alpha-2 codes for an entity's country claims, or `null`
 * when the entity has no resolvable country.
 */
export function getEntityCountryCode(
  wikiEntity: WikiEntity | null | undefined
): string[] | null {
  const claims = wikiEntity?.claims;
  if (!claims) return null;

  for (const property of COUNTRY_PROPERTIES) {
    const values = claims[property]?.values;
    if (!values?.length) continue;

    const codes = uniq(
      values
        .map((item) =>
          typeof item.value === "string"
            ? COUNTRIES[item.value]?.cc2
            : undefined
        )
        .filter((cc2): cc2 is string => typeof cc2 === "string")
        .map((cc2) => cc2.toLowerCase())
    );

    if (codes.length) return codes;
  }

  return null;
}
