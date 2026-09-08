import type { WikiEntities, WikiEntitiesParams, WikiEntity } from "./types";
import { isItemId } from "./utils";
import { getEntities as getWikidataEntities } from "./wikidata";
import { getEntityTypesByNames } from "./wikidata/entity-types";
import { queryPages } from "./wikipedia/api";
import { convertToSimpleEntity } from "./simple-entity/convert-to-simple-entity";
import type { ConvertToSimpleEntityOptions } from "./simple-entity/convert-to-simple-entity";
import type { SimpleEntity } from "./simple-entity/simple-entity";

// ---------------------------------------------------------------------------
// Public API
//
// Deliberately small. Anything not listed here is an implementation detail and
// may change without a major release.
// ---------------------------------------------------------------------------

/** Flatten a raw `wbgetentities` entity — for JSON you fetched yourself. */
export {
  simplifyEntity,
  type SimplifyEntityOptionsType,
  type WikibaseEntityJson
} from "./wikidata/simplify-entity";

/** Query Wikipedia articles directly, without going through Wikidata. */
export {
  queryPages,
  type QueryPagesOptions,
  type QueryPagesResult,
  type ResolvedTitle,
  type WikipediaPage
} from "./wikipedia/api";

/** Resolve DBpedia ontology types for English Wikipedia titles. */
export {
  getEntityTypesByNames,
  getDbpediaEndpoint,
  setDbpediaEndpoint,
  type EntityTypesOptions
} from "./wikidata/entity-types";

export { setUserAgent, getUserAgent } from "./request";
export { ApiError, HttpError, WikiEntityError } from "./errors";

export {
  convertToSimpleEntity,
  SimpleEntityType,
  type ConvertToSimpleEntityOptions,
  type SimpleEntity,
  type SimpleEntityData
} from "./simple-entity";

export type {
  ParamClaimsType,
  WikiEntities,
  WikiEntitiesParams,
  WikiEntity,
  WikidataBaseEntity,
  WikidataEntities,
  WikidataEntitiesParams,
  WikidataEntity,
  WikidataEntityClaims,
  WikidataGlobeCoordinateValue,
  WikidataMonolingualTextValue,
  WikidataProp,
  WikidataProperty,
  WikidataPropertyValue,
  WikidataQuantityValue,
  WikidataRank,
  WikidataTimeValue
} from "./types";

/**
 * Fetch entities from Wikidata, optionally enriched with data from Wikipedia
 * (page id, extract, redirects, categories) and DBpedia (ontology types).
 *
 * Results follow the order of the requested `ids`/`titles`; entities that do
 * not exist are omitted.
 *
 * @example
 * const [europe] = await getEntities({ language: "en", titles: ["Europe"] });
 */
export async function getEntities(
  params: WikiEntitiesParams
): Promise<WikiEntity[]> {
  const lang = params.language || "en";

  const entities: WikiEntities = await getWikidataEntities(params);

  const ids = Object.keys(entities).filter(isItemId);
  if (ids.length === 0) return [];

  const wantsWikipedia = Boolean(
    params.extract ||
    params.redirects ||
    params.categories ||
    params.wikiPageId !== false
  );

  const tasks: Promise<void>[] = [];
  if (wantsWikipedia) {
    tasks.push(enrichFromWikipedia(entities, ids, lang, params));
  } else {
    // `pageid` always means "Wikipedia page id"; without the Wikipedia lookup
    // we would otherwise leak Wikidata's own page id under that name.
    for (const id of ids) delete entities[id]?.pageid;
  }

  if (params.types === true || Array.isArray(params.types)) {
    tasks.push(enrichWithTypes(entities, ids, params));
  }

  await Promise.all(tasks);

  return orderEntities(entities, ids, params);
}

/**
 * {@link getEntities} followed by {@link convertToSimpleEntity}, in one call.
 *
 * The language is taken from `params`, so it cannot drift from the one the
 * entities were fetched in — passing a different language to
 * `convertToSimpleEntity` by hand silently mixes languages, because `name` and
 * `about` come from the fetch while `wikiPageTitle` is read from the sitelinks
 * of whatever language you passed.
 *
 * @example
 * const entities = await getSimpleEntities({
 *   language: "en",
 *   ids: ["Q937"],
 *   types: true,
 *   extract: 2
 * });
 */
export async function getSimpleEntities(
  params: WikiEntitiesParams,
  options?: ConvertToSimpleEntityOptions
): Promise<SimpleEntity[]> {
  const lang = params.language || "en";
  const entities = await getEntities(params);
  return entities.map((entity) => convertToSimpleEntity(entity, lang, options));
}

/** Attach Wikipedia `pageid`, `extract`, `redirects` and `categories`. */
async function enrichFromWikipedia(
  entities: WikiEntities,
  ids: string[],
  lang: string,
  params: WikiEntitiesParams
): Promise<void> {
  const idOfTitle = new Map<string, string>();
  for (const id of ids) {
    const title = entities[id]?.sitelinks?.[lang];
    // First sitelink wins: two items sharing an article would be a data error.
    if (title && !idOfTitle.has(title)) idOfTitle.set(title, id);
  }

  if (idOfTitle.size === 0) {
    for (const id of ids) delete entities[id]?.pageid;
    return;
  }

  const { pages, requestedTitleOf } = await queryPages({
    lang,
    titles: [...idOfTitle.keys()],
    followRedirects: true,
    ...(params.extract ? { extract: params.extract } : {}),
    ...(params.redirects ? { redirects: true } : {}),
    ...(params.categories ? { categories: true } : {}),
    ...(params.httpTimeout === undefined
      ? {}
      : { httpTimeout: params.httpTimeout }),
    ...(params.signal === undefined ? {} : { signal: params.signal })
  });

  const enriched = new Set<string>();

  for (const page of pages) {
    // MediaWiki normalises titles and follows redirects, so the returned title
    // is not necessarily the one we asked for.
    const requested = requestedTitleOf.get(page.title) ?? page.title;
    const id = idOfTitle.get(requested);
    const entity = id === undefined ? undefined : entities[id];
    if (!entity || id === undefined) continue;

    enriched.add(id);
    if (params.wikiPageId === false) delete entity.pageid;
    else if (page.pageid) entity.pageid = page.pageid;

    if (params.extract && page.extract) entity.extract = page.extract;
    if (params.redirects && page.redirects) entity.redirects = page.redirects;
    if (params.categories && page.categories) {
      entity.categories = page.categories;
    }
  }

  for (const id of ids) {
    if (!enriched.has(id)) delete entities[id]?.pageid;
  }
}

/**
 * Attach DBpedia ontology types. Types are best-effort enrichment: DBpedia is a
 * third-party endpoint with frequent downtime, so failures leave `types` unset
 * rather than failing the whole call.
 */
async function enrichWithTypes(
  entities: WikiEntities,
  ids: string[],
  params: WikiEntitiesParams
): Promise<void> {
  const idsOfName = new Map<string, string[]>();
  for (const id of ids) {
    // DBpedia is built from the English Wikipedia only.
    const name = entities[id]?.sitelinks?.["en"];
    if (!name) continue;
    const list = idsOfName.get(name);
    if (list) list.push(id);
    else idsOfName.set(name, [id]);
  }

  if (idsOfName.size === 0) return;

  try {
    const types = await getEntityTypesByNames([...idsOfName.keys()], {
      prefixes: Array.isArray(params.types) ? params.types : undefined,
      ...(params.httpTimeout === undefined
        ? {}
        : { httpTimeout: params.httpTimeout }),
      ...(params.signal === undefined ? {} : { signal: params.signal })
    });

    for (const [name, entityIds] of idsOfName) {
      const entityTypes = types.get(name);
      if (!entityTypes?.length) continue;
      for (const id of entityIds) {
        const entity = entities[id];
        if (entity) entity.types = entityTypes;
      }
    }
  } catch {
    // Leave `types` unset; the Wikidata data is still usable.
  }
}

/** Return entities in the order their ids/titles were requested. */
function orderEntities(
  entities: WikiEntities,
  ids: string[],
  params: WikiEntitiesParams
): WikiEntity[] {
  if (params.ids?.length) {
    const seen = new Set<string>();
    const ordered: WikiEntity[] = [];
    for (const requested of params.ids) {
      const entity =
        entities[requested] ?? findByResolvedId(entities, requested);
      if (entity && !seen.has(entity.id)) {
        seen.add(entity.id);
        ordered.push(entity);
      }
    }
    // Anything the API returned under a different key (redirects) still counts.
    for (const id of ids) {
      const entity = entities[id];
      if (entity && !seen.has(entity.id)) {
        seen.add(entity.id);
        ordered.push(entity);
      }
    }
    return ordered;
  }

  // `wbgetentities` answers in request order, which our batching preserves.
  return ids
    .map((id) => entities[id])
    .filter((entity): entity is WikiEntity => entity !== undefined);
}

function findByResolvedId(
  entities: WikiEntities,
  requested: string
): WikiEntity | undefined {
  for (const entity of Object.values(entities)) {
    if (entity.redirectsFromId === requested) return entity;
  }
  return undefined;
}

export interface MapRedirectsOptions {
  httpTimeout?: number;
  signal?: AbortSignal;
}

/**
 * Resolve Wikipedia redirect titles to the articles they point at.
 *
 * @returns A map of `redirectTitle -> targetTitle`, containing only the titles
 * that actually are redirects.
 *
 * @example
 * await mapRedirects(["Brashov"], "ro"); // { Brashov: "Brașov" }
 */
export async function mapRedirects(
  titles: string[],
  lang: string,
  options: MapRedirectsOptions = {}
): Promise<Record<string, string>> {
  if (!titles.length) return {};

  const { resolved } = await queryPages({
    lang,
    titles,
    followRedirects: true,
    ...(options.httpTimeout === undefined
      ? {}
      : { httpTimeout: options.httpTimeout }),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  });

  const result: Record<string, string> = {};
  for (const [requested, target] of resolved) {
    if (target.redirected && target.title !== requested) {
      result[requested] = target.title;
    }
  }

  return result;
}
