import { ApiError } from "../errors";
import request from "../request";
import { WIKIDATA_PROPS, type WikidataEntitiesParams } from "../types";
import { chunk, isEntityId } from "../utils";
import { queryPages } from "../wikipedia/api";
import type { RawWikidataEntities, RawWikidataEntity } from "./raw-types";
import { MUL_LANGUAGE } from "./simplify-entity";

export const API_URL = "https://www.wikidata.org/w/api.php";

/** `wbgetentities` accepts at most 50 ids/titles per request. */
export const MAX_IDS_PER_REQUEST = 50;
/** Overall cap, mirroring the documented limit of the public API. */
export const MAX_IDS = 500;

interface WbGetEntitiesResponse {
  entities?: Record<string, RawWikidataEntity>;
  error?: { code?: string; info?: string };
}

export interface FetchEntitiesResult {
  entities: RawWikidataEntities;
  /** Requested titles the API could not resolve to an entity. */
  missingTitles: string[];
  /** Requested title -> entity key, for the titles that did resolve. */
  idOfTitle: Map<string, string>;
}

/**
 * Fetch up to {@link MAX_IDS_PER_REQUEST} entities in a single API call,
 * reporting which of the requested titles produced no entity.
 */
export async function fetchEntities(
  params: WikidataEntitiesParams
): Promise<FetchEntitiesResult> {
  validateParams(params);

  const titles = params.titles;

  const data = await request<WbGetEntitiesResponse>(API_URL, {
    params: {
      action: "wbgetentities",
      ids: params.ids,
      titles,
      sites: titles ? `${params.language || "en"}wiki` : undefined,
      // Normalisation resolves Wikipedia redirects, but the API only allows it
      // for a single title.
      normalize: titles?.length === 1 ? "1" : undefined,
      props: params.props ?? [...WIKIDATA_PROPS],
      languages: withMulLanguage(params.languages),
      redirects: params.followEntityRedirects === false ? "no" : "yes",
      format: "json",
      formatversion: "2"
    },
    timeout: params.httpTimeout,
    signal: params.signal
  });

  if (data.error) {
    throw new ApiError(
      data.error.info || "Wikidata API error",
      data.error.code,
      API_URL
    );
  }

  const entities: RawWikidataEntities = {};
  const missingTitles: string[] = [];
  const foundKeys: string[] = [];

  for (const [key, entity] of Object.entries(data.entities ?? {})) {
    // `-1`, `-2`, … keys and `missing` markers stand for ids/titles with no
    // entity behind them.
    if (!isEntityId(key) || entity.missing !== undefined) {
      if (typeof entity.title === "string") missingTitles.push(entity.title);
      continue;
    }

    if (entity.redirects?.to) entity.redirectsToId = entity.redirects.to;
    if (entity.redirects?.from) entity.redirectsFromId = entity.redirects.from;

    entities[key] = entity;
    foundKeys.push(key);
  }

  return {
    entities,
    missingTitles,
    idOfTitle: mapTitlesToIds(titles, missingTitles, foundKeys)
  };
}

/**
 * Many items only carry their name under the `mul` language code, so a request
 * that filters languages has to ask for it as well or the label comes back
 * empty.
 */
function withMulLanguage(
  languages: readonly string[] | undefined
): string[] | undefined {
  if (!languages?.length) return undefined;
  return languages.includes(MUL_LANGUAGE)
    ? [...languages]
    : [...languages, MUL_LANGUAGE];
}

/**
 * The API answers with the found entities in request order, so the resolved
 * titles line up with the returned keys once the missing ones are removed.
 */
function mapTitlesToIds(
  titles: readonly string[] | undefined,
  missingTitles: readonly string[],
  foundKeys: readonly string[]
): Map<string, string> {
  const idOfTitle = new Map<string, string>();
  if (!titles) return idOfTitle;

  const missing = new Set(missingTitles);
  const resolvedTitles = titles.filter((title) => !missing.has(title));

  // If the counts disagree the API normalised something and we can no longer
  // line the two lists up; ordering then falls back to the response order.
  if (resolvedTitles.length !== foundKeys.length) return idOfTitle;

  resolvedTitles.forEach((title, index) => {
    const key = foundKeys[index];
    if (key !== undefined) idOfTitle.set(title, key);
  });
  return idOfTitle;
}

/** Fetch up to {@link MAX_IDS_PER_REQUEST} entities in a single API call. */
export async function getEntities(
  params: WikidataEntitiesParams
): Promise<RawWikidataEntities> {
  return (await fetchEntities(params)).entities;
}

/**
 * Fetch entities in batches of {@link MAX_IDS_PER_REQUEST}, preserving the
 * order of the requested ids/titles. At most {@link MAX_IDS} are fetched.
 *
 * Titles that Wikidata cannot resolve are retried against the canonical title
 * Wikipedia reports for them, so redirects and alternative spellings still
 * find their entity.
 */
export async function getManyEntities(
  params: WikidataEntitiesParams
): Promise<RawWikidataEntities> {
  validateParams(params);

  const byTitle = !params.ids;
  const keyName = byTitle ? "titles" : "ids";
  const keyValues = (params[keyName] ?? []).slice(0, MAX_IDS);

  if (keyValues.length === 0) return {};

  const results = await Promise.all(
    chunk(keyValues, MAX_IDS_PER_REQUEST).map((values) =>
      fetchEntities({ ...params, [keyName]: values })
    )
  );

  const entities: RawWikidataEntities = {};
  const idOfTitle = new Map<string, string>();
  const missingTitles: string[] = [];

  for (const result of results) {
    Object.assign(entities, result.entities);
    for (const [title, id] of result.idOfTitle) idOfTitle.set(title, id);
    missingTitles.push(...result.missingTitles);
  }

  if (byTitle && missingTitles.length > 0) {
    await retryMissingTitles(params, missingTitles, entities, idOfTitle);
  }

  return byTitle ? orderByTitles(keyValues, idOfTitle, entities) : entities;
}

/**
 * Ask Wikipedia for the canonical title of everything Wikidata could not find
 * (redirects, alternative spellings) and look those up instead.
 */
async function retryMissingTitles(
  params: WikidataEntitiesParams,
  missingTitles: string[],
  entities: RawWikidataEntities,
  idOfTitle: Map<string, string>
): Promise<void> {
  const lang = params.language || "en";

  const { resolved } = await queryPages({
    lang,
    titles: missingTitles,
    followRedirects: true,
    ...(params.httpTimeout === undefined
      ? {}
      : { httpTimeout: params.httpTimeout }),
    ...(params.signal === undefined ? {} : { signal: params.signal })
  });

  const canonicalOfTitle = new Map<string, string>();
  for (const [title, target] of resolved) {
    if (target.title !== title) canonicalOfTitle.set(title, target.title);
  }
  if (canonicalOfTitle.size === 0) return;

  const canonicalTitles = [...new Set(canonicalOfTitle.values())];

  const results = await Promise.all(
    chunk(canonicalTitles, MAX_IDS_PER_REQUEST).map((values) =>
      fetchEntities({ ...params, ids: undefined, titles: values })
    )
  );

  const idOfCanonical = new Map<string, string>();
  for (const result of results) {
    Object.assign(entities, result.entities);
    for (const [title, id] of result.idOfTitle) idOfCanonical.set(title, id);
  }

  for (const [title, canonical] of canonicalOfTitle) {
    const id = idOfCanonical.get(canonical);
    if (id !== undefined) idOfTitle.set(title, id);
  }
}

/** Rebuild the entity map so its insertion order follows the requested titles. */
function orderByTitles(
  titles: readonly string[],
  idOfTitle: Map<string, string>,
  entities: RawWikidataEntities
): RawWikidataEntities {
  if (idOfTitle.size === 0) return entities;

  const ordered: RawWikidataEntities = {};
  for (const title of titles) {
    const id = idOfTitle.get(title);
    const entity = id === undefined ? undefined : entities[id];
    if (id !== undefined && entity && !(id in ordered)) ordered[id] = entity;
  }
  // Anything we could not tie back to a title still belongs in the result.
  for (const [id, entity] of Object.entries(entities)) {
    if (!(id in ordered)) ordered[id] = entity;
  }
  return ordered;
}

export function validateParams(params: WikidataEntitiesParams): void {
  const hasIds = Array.isArray(params.ids) && params.ids.length > 0;
  const hasTitles = Array.isArray(params.titles) && params.titles.length > 0;
  if (!hasIds && !hasTitles) {
    throw new TypeError(
      "Invalid params: a non-empty `ids` or `titles` array is required"
    );
  }
}
