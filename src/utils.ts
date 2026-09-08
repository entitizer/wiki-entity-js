export type { PlainObject, AnyPlainObject, StringPlainObject } from "./types";

/** Remove duplicates, preserving first-seen order. */
export function uniq<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/** Split `items` into consecutive chunks of at most `size` elements. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new RangeError("chunk size must be >= 1");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** `true` for a Wikidata item id such as `Q42`. */
export function isItemId(id: string): boolean {
  return /^Q[1-9]\d*$/.test(id);
}

/** `true` for a Wikidata property id such as `P31`. */
export function isPropertyId(id: string): boolean {
  return /^P[1-9]\d*$/.test(id);
}

/** `true` for any Wikidata entity id this package can fetch (`Q…` or `P…`). */
export function isEntityId(id: string): boolean {
  return isItemId(id) || isPropertyId(id);
}

/**
 * `true` for a Wikidata item id such as `Q42`.
 * @deprecated Use {@link isItemId}, or {@link isEntityId} to also accept properties.
 */
export const isValidWikiId = isItemId;
