export enum SimpleEntityType {
  EVENT = "E",
  ORG = "O",
  PERSON = "H",
  PLACE = "P",
  PRODUCT = "R",
  WORK = "W"
}

export const SIMPLE_ENTITY_TYPES = [
  SimpleEntityType.EVENT,
  SimpleEntityType.PERSON,
  SimpleEntityType.PLACE,
  SimpleEntityType.ORG,
  SimpleEntityType.PRODUCT,
  SimpleEntityType.WORK
];

export type SimpleEntityData = { [prop: string]: string[] };

export type SimpleEntity = {
  lang?: string;
  wikiDataId?: string;
  name?: string;
  abbr?: string;
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
};
