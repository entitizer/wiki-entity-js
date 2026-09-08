import countriesData from "../data/countries.json";
import entityTypesData from "../data/entity-types.json";
import type { SimpleEntityType } from "./simple-entity/simple-entity";

export interface CountryRecord {
  /** Wikidata item id, e.g. `Q145`. */
  id: string;
  /** ISO 3166-1 alpha-2 code, uppercase. */
  cc2: string;
  /** ISO 3166-1 alpha-3 code, uppercase. */
  cc3: string;
}

/**
 * Wikidata item id -> ISO country codes.
 * Regenerate with `npm run data:countries`.
 */
export const COUNTRIES: Readonly<Record<string, CountryRecord>> = countriesData;

interface EntityTypesDocument {
  version: number;
  generated?: string;
  counts?: Record<string, number>;
  /** Per type, a delta encoded, base-36 list of numeric Q-ids. */
  types: Record<string, string>;
}

const document = entityTypesData as unknown as EntityTypesDocument;

/** When the shipped Wikidata class tables were generated (`YYYY-MM-DD`). */
export const ENTITY_TYPES_GENERATED_AT: string | undefined = document.generated;

let entityTypeSets: Map<string, ReadonlySet<string>> | undefined;

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/**
 * Wikidata class ids for a {@link SimpleEntityType}.
 *
 * The tables hold tens of thousands of ids, so they ship delta encoded and are
 * expanded on first use rather than at import time.
 *
 * Regenerate with `npm run data:entity-types`.
 */
export function getEntityTypeIds(
  type: SimpleEntityType | string
): ReadonlySet<string> {
  entityTypeSets ??= new Map(
    Object.entries(document.types).map(([key, encoded]) => [
      key,
      decodeIds(encoded)
    ])
  );
  return entityTypeSets.get(type) ?? EMPTY_SET;
}

/** Expand `"5.1a.3"` into `Set { "Q5", "Q51", "Q54" }`. */
export function decodeIds(encoded: string): ReadonlySet<string> {
  const ids = new Set<string>();
  if (!encoded) return ids;

  let current = 0;
  for (const delta of encoded.split(".")) {
    const value = Number.parseInt(delta, 36);
    if (!Number.isFinite(value)) continue;
    current += value;
    ids.add(`Q${current}`);
  }
  return ids;
}
