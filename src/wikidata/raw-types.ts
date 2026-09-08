/**
 * The shapes returned by `action=wbgetentities`, before simplification.
 * Everything here is optional: the API only sends the props that were asked for.
 */
export interface RawLangValue {
  language?: string;
  value?: string;
}

export interface RawWikidataEntity {
  id?: string;
  type?: string;
  pageid?: number;
  ns?: number;
  title?: string;
  lastrevid?: number;
  modified?: string;
  datatype?: string;
  missing?: unknown;
  labels?: Record<string, RawLangValue>;
  descriptions?: Record<string, RawLangValue>;
  aliases?: Record<string, RawLangValue[]>;
  sitelinks?: Record<string, { title?: string; badges?: string[] }>;
  claims?: Record<string, RawClaim[]>;
  redirects?: { from?: string; to?: string };
  /** Added by this package when the API reports a redirect. */
  redirectsToId?: string;
  /** Added by this package when the API reports a redirect. */
  redirectsFromId?: string;
}

export interface RawSnak {
  snaktype?: string;
  property?: string;
  datatype?: string;
  datavalue?: { type?: string; value?: unknown } | null;
}

export interface RawClaim {
  id?: string;
  type?: string;
  rank?: string;
  mainsnak?: RawSnak | null;
  qualifiers?: Record<string, RawSnak[]> | null;
  references?: unknown[];
}

export type RawWikidataEntities = Record<string, RawWikidataEntity>;
