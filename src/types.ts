export type PlainObject<T> = {
  [index: string]: T;
};

export type AnyPlainObject = PlainObject<unknown>;
export type StringPlainObject = PlainObject<string>;

/** Statement rank as modelled by Wikibase. */
export type WikidataRank = "preferred" | "normal" | "deprecated";

/**
 * A globe coordinate claim value.
 * @see https://www.wikidata.org/wiki/Help:Data_type#Geographic_coordinates
 */
export interface WikidataGlobeCoordinateValue {
  latitude: number;
  longitude: number;
  precision?: number | null;
  globe?: string;
  altitude?: number | null;
}

/**
 * A point in time claim value. `time` uses a signed, zero padded year, so
 * BCE dates start with `-`.
 * @see https://www.wikidata.org/wiki/Help:Dates
 */
export interface WikidataTimeValue {
  time: string;
  precision: number;
  timezone?: number;
  before?: number;
  after?: number;
  calendarmodel?: string;
}

/** A quantity claim value. Bounds are absent for exact quantities. */
export interface WikidataQuantityValue {
  amount: string;
  unit?: string;
  upperBound?: string;
  lowerBound?: string;
}

export interface WikidataMonolingualTextValue {
  text: string;
  language: string;
}

/**
 * The simplified value of a claim. `value` is a scalar for the common data
 * types and the raw Wikibase object for structured ones (time, quantity,
 * globe-coordinate); `value_string` then carries a readable rendering.
 */
export interface WikidataPropertyValue {
  datatype: string;
  value:
    | string
    | number
    | WikidataTimeValue
    | WikidataQuantityValue
    | WikidataGlobeCoordinateValue;
  rank?: WikidataRank;
  pageid?: number;
  value_string?: string;
  label?: string;
  description?: string;
  qualifiers?: WikidataEntityClaims | null;
}

export interface WikidataBaseEntity {
  id: string;
  label?: string;
  description?: string;
  [index: string]: unknown;
}

export interface WikidataProperty extends WikidataBaseEntity {
  values: WikidataPropertyValue[];
}

export type WikidataEntityClaims = PlainObject<WikidataProperty>;

export interface WikidataEntity extends WikidataBaseEntity {
  pageid?: number;
  /** Wikibase datatype, present on property (`P…`) entities only. */
  datatype?: string;
  aliases?: string[];
  sitelinks?: PlainObject<string>;
  claims?: WikidataEntityClaims;
  labels?: PlainObject<string>;
  descriptions?: PlainObject<string>;
  redirectsToId?: string;
  redirectsFromId?: string;
}

export type WikidataEntities = PlainObject<WikidataEntity>;

export interface WikiEntity extends WikidataEntity {
  extract?: string;
  types?: string[];
  redirects?: string[];
  categories?: string[];
}

export type WikiEntities = PlainObject<WikiEntity>;

export type ParamClaimsType = "none" | "all" | "item" | "property";

export const WIKIDATA_PROPS = [
  "info",
  "sitelinks",
  "aliases",
  "labels",
  "descriptions",
  "claims",
  "datatype"
] as const;

export type WikidataPropsParamType = (typeof WIKIDATA_PROPS)[number];

/**
 * Entity props to request from the Wikibase API.
 *
 * Kept as an enum for backwards compatibility; plain strings work too, since
 * every member's value equals its name.
 */
export enum WikidataPropsParam {
  info = "info",
  sitelinks = "sitelinks",
  aliases = "aliases",
  labels = "labels",
  descriptions = "descriptions",
  claims = "claims",
  datatype = "datatype"
}

export interface WikidataEntitiesParams {
  /** Wikidata entity ids, e.g. `["Q42"]`. Max 500. */
  ids?: string[];
  /** Wikipedia article titles, resolved against `language`. Max 500. */
  titles?: string[];
  /** Which props to fetch. Defaults to all of them. */
  props?: (WikidataPropsParamType | WikidataPropsParam)[];
  /** Language of `titles` and of the resulting `label`/`description`. */
  language?: string;
  /** Pass `"no"` to keep entity redirects unresolved. Default: `"yes"`. */
  redirect?: string;
  /** How deeply to resolve claim values. Default: `"none"`. */
  claims?: ParamClaimsType;
  /** Per request timeout in milliseconds. */
  httpTimeout?: number;
  /** Extra languages to populate `WikiEntity.labels` with. */
  languages?: string[];
  /** Cancellation signal propagated to every underlying request. */
  signal?: AbortSignal;
}

export interface WikiEntitiesParams extends WikidataEntitiesParams {
  /** Number of sentences in the Wikipedia extract. `0`/absent: no extract. */
  extract?: number;
  /**
   * `true` to resolve DBpedia ontology types, or an array of prefixes to keep
   * (e.g. `["dbo", "schema"]`).
   */
  types?: boolean | string[];
  /** Fetch the titles of Wikipedia articles redirecting to the entity. */
  redirects?: boolean;
  /** Fetch Wikipedia article categories. */
  categories?: boolean;
  /** Fetch the Wikipedia `pageid`. Default: `true`. */
  wikiPageId?: boolean;
}
