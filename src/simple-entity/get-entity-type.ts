import type { PlainObject, WikiEntity } from "../types";
import { SimpleEntityType } from "./simple-entity";

/** DBpedia/schema.org ontology types mapped to a {@link SimpleEntityType}. */
const TYPES_MAP: PlainObject<SimpleEntityType> = {
  "dbo:FictionalCharacter": SimpleEntityType.WORK,
  "wikidata:Q95074": SimpleEntityType.WORK,
  "dbo:Book": SimpleEntityType.WORK,
  "dbo:Newspaper": SimpleEntityType.WORK,
  "dbo:Film": SimpleEntityType.WORK,
  "dbo:MusicalWork": SimpleEntityType.WORK,
  "dbo:TelevisionShow": SimpleEntityType.WORK,
  "wikidata:Q571": SimpleEntityType.WORK,

  "dbo:PopulatedPlace": SimpleEntityType.PLACE,
  "dbo:Place": SimpleEntityType.PLACE,
  "schema:Place": SimpleEntityType.PLACE,
  "schema:City": SimpleEntityType.PLACE,
  "schema:Country": SimpleEntityType.PLACE,
  "dbo:Location": SimpleEntityType.PLACE,
  "wikidata:Q515": SimpleEntityType.PLACE,
  "wikidata:Q486972": SimpleEntityType.PLACE,

  "dbo:Company": SimpleEntityType.ORG,
  "schema:Organization": SimpleEntityType.ORG,
  "dbo:Organisation": SimpleEntityType.ORG,
  "wikidata:Q43229": SimpleEntityType.ORG,

  "schema:Person": SimpleEntityType.PERSON,
  "wikidata:Q215627": SimpleEntityType.PERSON,
  "dul:NaturalPerson": SimpleEntityType.PERSON,
  "wikidata:Q5": SimpleEntityType.PERSON,
  "foaf:Person": SimpleEntityType.PERSON,
  "dbo:Person": SimpleEntityType.PERSON,

  "wikidata:Q1656682": SimpleEntityType.EVENT,
  "dul:Event": SimpleEntityType.EVENT,
  "schema:Event": SimpleEntityType.EVENT,
  "dbo:Event": SimpleEntityType.EVENT,

  "dbo:Software": SimpleEntityType.PRODUCT,
  "dbo:Device": SimpleEntityType.PRODUCT,
  "schema:Product": SimpleEntityType.PRODUCT,
  "wikidata:Q7397": SimpleEntityType.PRODUCT
};

const TYPES_NAME_MAP = Object.entries(TYPES_MAP).reduce<
  Map<SimpleEntityType, Set<string>>
>((map, [name, type]) => {
  const names = map.get(type);
  if (names) names.add(name);
  else map.set(type, new Set([name]));
  return map;
}, new Map());

/**
 * Derive a {@link SimpleEntityType} from the DBpedia ontology types attached to
 * an entity (see `getEntities({ types: true })`).
 */
export function getEntityType(
  wikiEntity: WikiEntity
): SimpleEntityType | undefined {
  const types = wikiEntity.types;
  if (!types?.length) return undefined;

  // DBpedia often types an organisation as a Person too, via its founder's
  // infobox. When both are present the organisation is the better answer.
  if (
    containsType(types, SimpleEntityType.ORG) &&
    containsType(types, SimpleEntityType.PERSON)
  ) {
    return SimpleEntityType.ORG;
  }

  for (const type of types) {
    const mapped = TYPES_MAP[type];
    if (mapped) return mapped;
  }

  return undefined;
}

function containsType(types: string[], type: SimpleEntityType): boolean {
  const names = TYPES_NAME_MAP.get(type);
  if (!names) return false;
  return types.some((name) => names.has(name));
}
