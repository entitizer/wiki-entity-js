import { getEntityTypeIds } from "../data";
import type { WikiEntity } from "../types";
import { SIMPLE_ENTITY_TYPES, type SimpleEntityType } from "./simple-entity";

/**
 * Derive a {@link SimpleEntityType} from the entity's `P31` (instance of)
 * claims, matched against the generated Wikidata class tables.
 */
export function getEntityType(
  wikiEntity: WikiEntity
): SimpleEntityType | undefined {
  return getTypeByProp(wikiEntity, "P31");
}

function getTypeByProp(
  wikiEntity: WikiEntity,
  property: string
): SimpleEntityType | undefined {
  const values = wikiEntity.claims?.[property]?.values;
  if (!values?.length) return undefined;

  const classIds = values
    .map((value) => value.value)
    .filter((value): value is string => typeof value === "string");

  for (const type of SIMPLE_ENTITY_TYPES) {
    const ids = getEntityTypeIds(type);
    if (classIds.some((id) => ids.has(id))) return type;
  }

  return undefined;
}
