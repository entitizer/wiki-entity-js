import type { WikiEntity } from "../types";
import { uniq } from "../utils";
import { getEntityCountryCode } from "./get-entity-country";
import { getEntityData } from "./get-entity-data";
import { getEntityType as getEntityInstanceType } from "./get-entity-instance-type";
import { getEntityType as getEntityOntologyType } from "./get-entity-type";
import { getEntityTypeByExtract } from "./get-entity-type-by-extract";
import type { SimpleEntity, SimpleEntityType } from "./simple-entity";

export type ConvertToSimpleEntityOptions = {
  /** Used when no type could be detected. */
  defaultType?: SimpleEntityType;
};

/** Ontology types that are too generic to be worth reporting. */
const GENERIC_TYPE = /:(Thing|Agent)$/;

/**
 * Flatten a {@link WikiEntity} into the compact {@link SimpleEntity} shape.
 *
 * The entity type is resolved from the DBpedia ontology types first, then from
 * the `P31` claims, and finally from the extract's opening sentence.
 */
export function convertToSimpleEntity(
  wikiEntity: WikiEntity,
  lang: string,
  options: ConvertToSimpleEntityOptions = {}
): SimpleEntity {
  const entity: SimpleEntity = {
    lang: lang.toLowerCase(),
    wikiDataId: wikiEntity.id
  };

  if (wikiEntity.label !== undefined) entity.name = wikiEntity.label;
  if (wikiEntity.description !== undefined) {
    entity.description = wikiEntity.description;
  }
  if (wikiEntity.pageid !== undefined) entity.wikiPageId = wikiEntity.pageid;
  if (wikiEntity.extract !== undefined) entity.about = wikiEntity.extract;
  if (wikiEntity.redirectsToId) entity.redirectsToId = wikiEntity.redirectsToId;
  if (wikiEntity.redirectsFromId) {
    entity.redirectsFromId = wikiEntity.redirectsFromId;
  }

  if (wikiEntity.types?.length) {
    const types = uniq(
      wikiEntity.types.filter((type) => !GENERIC_TYPE.test(type))
    );
    if (types.length) entity.types = types;
  }

  const type = detectType(wikiEntity, entity, lang, options);
  if (type) entity.type = type;

  const wikiPageTitle = wikiEntity.sitelinks?.[lang];
  if (wikiPageTitle !== undefined) entity.wikiPageTitle = wikiPageTitle;

  if (wikiEntity.categories?.length) {
    entity.categories = uniq(wikiEntity.categories);
  }

  if (wikiEntity.claims && Object.keys(wikiEntity.claims).length > 0) {
    const data = getEntityData(wikiEntity);
    if (data && Object.keys(data).length > 0) entity.data = data;

    const countryCodes = getEntityCountryCode(wikiEntity);
    if (countryCodes) entity.countryCodes = countryCodes;
  }

  return entity;
}

function detectType(
  wikiEntity: WikiEntity,
  entity: SimpleEntity,
  lang: string,
  options: ConvertToSimpleEntityOptions
): SimpleEntityType | undefined {
  return (
    getEntityOntologyType(wikiEntity) ??
    getEntityInstanceType(wikiEntity) ??
    // Only trust the extract when no ontology types were available at all.
    (entity.types ? undefined : getEntityTypeByExtract(entity.about, lang)) ??
    options.defaultType
  );
}
