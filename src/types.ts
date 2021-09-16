export type PlainObject<T> = {
  [index: string]: T;
};

export type AnyPlainObject = PlainObject<any>;
export type StringPlainObject = PlainObject<string>;

export interface WikidataPropertyValue {
  datatype: string;
  value: any;
  pageid?: number;
  value_string?: string;
  label?: string;
  description?: string;
}

export interface WikidataBaseEntity {
  id: string;
  label?: string;
  description?: string;
  [index: string]: any;
}

export interface WikidataProperty extends WikidataBaseEntity {
  values: WikidataPropertyValue[];
}

export type WikidataEntityClaims = PlainObject<WikidataProperty>;

export interface WikidataEntity extends WikidataBaseEntity {
  pageid?: number;
  aliases?: string[];
  sitelinks?: PlainObject<string>;
  claims?: WikidataEntityClaims;
  labels?: PlainObject<string>;
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
export interface WikidataEntitiesParams {
  ids?: string[];
  titles?: string[];
  props?: WikidataPropsParam[];
  language?: string;
  // sites?: string[] | string,
  // sitefilter?: string[] | string,
  redirect?: string;
  claims?: ParamClaimsType;
  httpTimeout?: number;
  languages?: string[];
}

export enum WikidataPropsParam {
  info = "info",
  sitelinks = "sitelinks",
  aliases = "aliases",
  labels = "labels",
  descriptions = "descriptions",
  claims = "claims",
  datatype = "datatype"
}

export interface WikiEntitiesParams extends WikidataEntitiesParams {
  /**
   * Sentences count. 0 - no extract
   */
  extract?: number;
  types?: boolean | string[];
  redirects?: boolean;
  categories?: boolean;
}
