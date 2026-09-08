/** Coarse entity category, encoded as a single letter. */
export enum SimpleEntityType {
  EVENT = "E",
  ORG = "O",
  PERSON = "H",
  PLACE = "P",
  PRODUCT = "R",
  WORK = "W"
}

/**
 * Detection order. The first type whose class list matches an entity's `P31`
 * wins, so the more specific categories come first.
 */
export const SIMPLE_ENTITY_TYPES: readonly SimpleEntityType[] = [
  SimpleEntityType.EVENT,
  SimpleEntityType.PERSON,
  SimpleEntityType.PLACE,
  SimpleEntityType.ORG,
  SimpleEntityType.PRODUCT,
  SimpleEntityType.WORK
];

/** Claim values keyed by property id, e.g. `{ P31: ["Q5"] }`. */
export type SimpleEntityData = { [prop: string]: string[] };

export type SimpleEntity = {
  /** Language the entity was resolved in. Always set. */
  lang: string;
  /** Wikidata item id. Always set. */
  wikiDataId: string;
  name?: string;
  description?: string;
  about?: string;
  wikiPageId?: number;
  wikiPageTitle?: string;
  type?: SimpleEntityType;
  types?: string[];
  countryCodes?: string[];
  data?: SimpleEntityData;
  categories?: string[];
  redirectsToId?: string;
  redirectsFromId?: string;
};
