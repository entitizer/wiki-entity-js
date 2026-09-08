import type {
  WikidataEntities,
  WikidataEntitiesParams,
  WikidataEntity,
  WikidataEntityClaims,
  WikidataProperty,
  WikidataPropertyValue
} from "../types";
import { chunk, isEntityId, isItemId, isPropertyId } from "../utils";
import { getManyEntities, MAX_IDS } from "./api";
import { simplifyEntity } from "./simplify-entity";

/** Props needed to describe a referenced entity, without pulling its claims. */
const META_PROPS = ["info", "labels", "descriptions", "datatype"] as const;

/**
 * Fetch and simplify Wikidata entities, optionally resolving the labels of the
 * properties and item values referenced by their claims.
 */
export async function getEntities(
  params: WikidataEntitiesParams
): Promise<WikidataEntities> {
  const claimsMode = params.claims || "none";
  const lang = params.language || "en";

  const raw = await getManyEntities(params);

  const entities: WikidataEntities = {};
  for (const [id, data] of Object.entries(raw)) {
    if (!isEntityId(id)) continue;
    entities[id] = simplifyEntity(lang, data);
  }

  const tasks: Promise<void>[] = [];
  if (claimsMode === "all" || claimsMode === "property") {
    tasks.push(resolveProperties(entities, params));
  }
  if (claimsMode === "all" || claimsMode === "item") {
    tasks.push(resolveItemValues(entities, params));
  }
  await Promise.all(tasks);

  return entities;
}

/** Attach `label`/`description`/`datatype` to every property of every claim. */
async function resolveProperties(
  entities: WikidataEntities,
  params: WikidataEntitiesParams
): Promise<void> {
  const byId = new Map<string, WikidataProperty[]>();
  for (const entity of Object.values(entities)) {
    forEachProperty(entity.claims, (property) => {
      const list = byId.get(property.id);
      if (list) list.push(property);
      else byId.set(property.id, [property]);
    });
  }

  const ids = [...byId.keys()].filter(isPropertyId);
  if (ids.length === 0) return;

  const meta = await fetchEntityMeta(ids, params);
  for (const [id, properties] of byId) {
    const source = meta[id];
    if (!source) continue;
    for (const property of properties) copyMeta(source, property);
  }
}

/** Attach `label`/`description` to every `wikibase-item` claim value. */
async function resolveItemValues(
  entities: WikidataEntities,
  params: WikidataEntitiesParams
): Promise<void> {
  await exploreEntityClaims(
    Object.values(entities).map((entity) => entity.claims),
    params
  );
}

/**
 * Resolve the `wikibase-item` values inside one or more claim trees, attaching
 * a `label` and `description` to each of them in place.
 */
export async function exploreEntityClaims(
  claims:
    WikidataEntityClaims | undefined | (WikidataEntityClaims | undefined)[],
  params: WikidataEntitiesParams
): Promise<void> {
  const trees = Array.isArray(claims) ? claims : [claims];
  const byId = new Map<string, WikidataPropertyValue[]>();
  for (const tree of trees) {
    forEachValue(tree, (value) => {
      if (typeof value.value !== "string" || !isItemId(value.value)) return;
      const list = byId.get(value.value);
      if (list) list.push(value);
      else byId.set(value.value, [value]);
    });
  }

  const ids = [...byId.keys()];
  if (ids.length === 0) return;

  const meta = await fetchEntityMeta(ids, params);
  for (const [id, values] of byId) {
    const source = meta[id];
    if (!source) continue;
    for (const value of values) copyMeta(source, value);
  }
}

function copyMeta(
  source: WikidataEntity,
  target: { label?: string; description?: string; datatype?: string }
): void {
  if (source.label !== undefined) target.label = source.label;
  if (source.description !== undefined) target.description = source.description;
  if (source.datatype !== undefined) target.datatype = source.datatype;
}

/**
 * Fetch label/description metadata for arbitrarily many ids, in a single pass
 * per {@link MAX_IDS} sized group and without recursing into their claims.
 */
async function fetchEntityMeta(
  ids: string[],
  params: WikidataEntitiesParams
): Promise<WikidataEntities> {
  const lang = params.language || "en";
  const result: WikidataEntities = {};

  for (const group of chunk(ids, MAX_IDS)) {
    const raw = await getManyEntities({
      ids: group,
      language: lang,
      languages: params.languages,
      props: [...META_PROPS],
      redirect: params.redirect,
      httpTimeout: params.httpTimeout,
      signal: params.signal
    });
    for (const [id, data] of Object.entries(raw)) {
      result[id] = simplifyEntity(lang, data);
    }
  }

  return result;
}

function forEachProperty(
  claims: WikidataEntityClaims | undefined,
  fn: (property: WikidataProperty) => void
): void {
  if (!claims) return;
  for (const property of Object.values(claims)) {
    fn(property);
    for (const value of property.values) {
      if (value.qualifiers) forEachProperty(value.qualifiers, fn);
    }
  }
}

function forEachValue(
  claims: WikidataEntityClaims | undefined,
  fn: (value: WikidataPropertyValue) => void
): void {
  if (!claims) return;
  for (const property of Object.values(claims)) {
    for (const value of property.values) {
      fn(value);
      if (value.qualifiers) forEachValue(value.qualifiers, fn);
    }
  }
}
