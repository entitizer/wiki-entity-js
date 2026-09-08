import type { PlainObject, WikidataEntity } from "../types";
import type { RawLangValue, RawWikidataEntity } from "./raw-types";
import { simplifyClaims } from "./simplify-claims";

export type SimplifyEntityOptionsType = {
  labels?: boolean;
  descriptions?: boolean;
  aliases?: boolean;
  sitelinks?: boolean;
  claims?: boolean;
  /** Keep statements Wikidata marks as deprecated. Default: `false`. */
  keepDeprecatedClaims?: boolean;
};

/**
 * Turn a raw `wbgetentities` entity into the flatter {@link WikidataEntity}
 * shape used across this package.
 */
/**
 * Wikidata's "multiple languages" code. Since 2024 a large share of items keep
 * their name only under `mul` — the label is spelled the same in every
 * language — and carry no per-language label at all.
 *
 * @see https://www.wikidata.org/wiki/Wikidata:Multilingual_labels
 */
export const MUL_LANGUAGE = "mul";

export function simplifyEntity(
  lang: string,
  data: RawWikidataEntity,
  options: SimplifyEntityOptionsType = {}
): WikidataEntity {
  const entity: WikidataEntity = { id: data.id ?? "" };

  if (data.pageid !== undefined) entity.pageid = data.pageid;
  // Only property (`P…`) entities carry a datatype.
  if (data.datatype !== undefined) entity.datatype = data.datatype;

  if (data.redirectsToId) entity.redirectsToId = data.redirectsToId;
  if (data.redirectsFromId) entity.redirectsFromId = data.redirectsFromId;

  if (options.labels !== false && data.labels) {
    entity.labels = simplifyLabels(data.labels);
    const label = entity.labels[lang] ?? entity.labels[MUL_LANGUAGE];
    if (label !== undefined) entity.label = label;
  }

  if (options.descriptions !== false && data.descriptions) {
    entity.descriptions = simplifyDescriptions(data.descriptions);
    const description = entity.descriptions[lang];
    if (description !== undefined) entity.description = description;
  }

  if (options.aliases !== false && data.aliases) {
    const byLang = simplifyAliases(data.aliases);
    const aliases = [
      ...new Set([...(byLang[lang] ?? []), ...(byLang[MUL_LANGUAGE] ?? [])])
    ];
    if (aliases.length) entity.aliases = aliases;
  }

  if (options.sitelinks !== false && data.sitelinks) {
    entity.sitelinks = simplifySitelinks(data.sitelinks);
  }

  if (options.claims !== false && data.claims) {
    entity.claims = simplifyClaims(data.claims, {
      keepDeprecated: options.keepDeprecatedClaims ?? false
    });
  }

  return entity;
}

export function simplifyAliases(
  data: Record<string, RawLangValue[]> | null | undefined
): PlainObject<string[]> {
  const result: PlainObject<string[]> = {};
  if (!data) return result;
  for (const lang of Object.keys(data)) {
    const values = data[lang];
    if (!Array.isArray(values)) continue;
    result[lang] = values
      .map((item) => item?.value)
      .filter((value): value is string => typeof value === "string");
  }
  return result;
}

export function simplifyDescriptions(
  data: Record<string, RawLangValue> | null | undefined
): PlainObject<string> {
  return simplifyLangValues(data);
}

export function simplifyLabels(
  data: Record<string, RawLangValue> | null | undefined
): PlainObject<string> {
  return simplifyLangValues(data);
}

/** Map `{ enwiki: { title } }` to `{ en: title }`. */
export function simplifySitelinks(
  data: Record<string, { title?: string }> | null | undefined
): PlainObject<string> {
  const result: PlainObject<string> = {};
  if (!data) return result;
  for (const site of Object.keys(data)) {
    const title = data[site]?.title;
    if (typeof title === "string") result[site.replace(/wiki$/, "")] = title;
  }
  return result;
}

function simplifyLangValues(
  data: Record<string, RawLangValue> | null | undefined
): PlainObject<string> {
  const result: PlainObject<string> = {};
  if (!data) return result;
  for (const lang of Object.keys(data)) {
    const value = data[lang]?.value;
    if (typeof value === "string") result[lang] = value;
  }
  return result;
}
