import { ApiError } from "../errors";
import request from "../request";
import type { StringPlainObject } from "../types";
import { chunk } from "../utils";

const API_URL = "https://$lang.wikipedia.org/w/api.php";

/** `action=query` accepts at most 50 titles per request. */
export const MAX_TITLES_PER_REQUEST = 50;
/**
 * `prop=extracts` refuses to render more than 20 intro extracts per request,
 * and only 1 when `exintro` is not set.
 */
export const MAX_TITLES_PER_EXTRACTS_REQUEST = 20;
/** Guard against a pathological `continue` loop. */
const MAX_CONTINUATIONS = 20;

export const apiUrl = (lang: string): string =>
  API_URL.replace("$lang", encodeURIComponent(lang));

export type ExtractType = {
  pageid: number;
  title: string;
  extract: string;
};

export type ExtractsParamsType = {
  lang: string;
  titles: string[];
  sentences?: number;
  httpTimeout?: number;
  signal?: AbortSignal;
};

export type ApiResult = {
  pageid: number;
  title: string;
  extract?: string;
  categories?: string[];
  redirects?: string[];
};

export interface QueryPagesOptions {
  /** Wikipedia language code, e.g. `"en"`. */
  lang: string;
  titles: readonly string[];
  /** Number of sentences of the lead section to extract. */
  extract?: number;
  /** Include the titles of articles redirecting to each page. */
  redirects?: boolean;
  /** Include the article's (non hidden) categories. */
  categories?: boolean;
  /** Follow redirects, so `titles` pointing at a redirect resolve to its target. */
  followRedirects?: boolean;
  httpTimeout?: number;
  signal?: AbortSignal;
}

export interface ResolvedTitle {
  /** The final page title, after normalisation and redirect resolution. */
  title: string;
  /** `true` when at least one hop was an actual page redirect. */
  redirected: boolean;
}

export interface QueryPagesResult {
  pages: ApiResult[];
  /** Requested title -> where it ended up. */
  resolved: Map<string, ResolvedTitle>;
  /**
   * Maps each *resolved* page title back to the title that was requested, after
   * MediaWiki normalisation and redirect resolution.
   */
  requestedTitleOf: Map<string, string>;
}

interface RawPage {
  pageid?: number;
  title?: string;
  missing?: boolean | string;
  extract?: string;
  categories?: { title?: string }[];
  redirects?: { title?: string }[];
}

interface QueryResponse {
  batchcomplete?: unknown;
  continue?: Record<string, string>;
  error?: { code?: string; info?: string };
  query?: {
    pages?: RawPage[] | Record<string, RawPage>;
    normalized?: { from?: string; to?: string }[];
    converted?: { from?: string; to?: string }[];
    redirects?: { from?: string; to?: string }[];
  };
}

/**
 * Query Wikipedia pages by title, transparently batching, paging through
 * `continue` responses and mapping the results back to the requested titles.
 */
export async function queryPages(
  options: QueryPagesOptions
): Promise<QueryPagesResult> {
  const titles = [...new Set(options.titles)].filter((t) => t.length > 0);

  const pages = new Map<string, ApiResult>();
  const resolved = new Map<string, ResolvedTitle>();
  const requestedTitleOf = new Map<string, string>();

  if (titles.length === 0) return { pages: [], resolved, requestedTitleOf };

  const batchSize = options.extract
    ? MAX_TITLES_PER_EXTRACTS_REQUEST
    : MAX_TITLES_PER_REQUEST;

  for (const batch of chunk(titles, batchSize)) {
    const forward = new Map<string, string>();
    const redirectHops = new Set<string>();
    let cont: Record<string, string> | undefined;

    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      const data = await request<QueryResponse>(apiUrl(options.lang), {
        params: { ...buildQueryParams(options, batch), ...cont },
        timeout: options.httpTimeout,
        signal: options.signal
      });

      if (data.error) {
        throw new ApiError(
          data.error.info || "Wikipedia API error",
          data.error.code,
          apiUrl(options.lang)
        );
      }

      for (const list of [
        data.query?.normalized,
        data.query?.converted,
        data.query?.redirects
      ]) {
        for (const item of list ?? []) {
          if (item.from && item.to) forward.set(item.from, item.to);
        }
      }
      for (const item of data.query?.redirects ?? []) {
        if (item.from && item.to) redirectHops.add(item.from);
      }

      mergePages(pages, data.query?.pages);

      cont = data.continue;
      if (!cont) break;
    }

    for (const title of batch) {
      const entry = resolveTitle(title, forward, redirectHops);
      resolved.set(title, entry);
      requestedTitleOf.set(entry.title, title);
    }
  }

  return { pages: [...pages.values()], resolved, requestedTitleOf };
}

/** Walk `from -> to` hops (normalisation, variant conversion, redirects). */
function resolveTitle(
  title: string,
  forward: Map<string, string>,
  redirectHops: ReadonlySet<string>
): ResolvedTitle {
  let current = title;
  let redirected = false;
  const seen = new Set([current]);
  for (;;) {
    const next = forward.get(current);
    if (next === undefined || seen.has(next))
      return { title: current, redirected };
    if (redirectHops.has(current)) redirected = true;
    seen.add(next);
    current = next;
  }
}

function buildQueryParams(
  options: QueryPagesOptions,
  titles: readonly string[]
): Record<string, string | readonly string[] | undefined> {
  const props: string[] = [];
  const params: Record<string, string | readonly string[] | undefined> = {
    action: "query",
    format: "json",
    formatversion: "2",
    titles
  };

  if (options.followRedirects) params["redirects"] = "1";

  if (options.extract) {
    props.push("extracts");
    params["exsentences"] = String(options.extract);
    params["explaintext"] = "1";
    // Without `exintro` MediaWiki silently lowers `exlimit` to 1, so only the
    // first requested title would come back with an extract.
    params["exintro"] = "1";
    params["exlimit"] = "max";
  }

  if (options.redirects) {
    props.push("redirects");
    params["rdlimit"] = "max";
    params["rdnamespace"] = "0";
  }

  if (options.categories) {
    props.push("categories");
    params["cllimit"] = "max";
    params["clshow"] = "!hidden";
  }

  if (props.length > 0) params["prop"] = props;

  return params;
}

function mergePages(
  pages: Map<string, ApiResult>,
  raw: RawPage[] | Record<string, RawPage> | undefined
): void {
  if (!raw) return;
  const list = Array.isArray(raw) ? raw : Object.values(raw);

  for (const page of list) {
    if (page.missing !== undefined || typeof page.title !== "string") continue;

    let item = pages.get(page.title);
    if (!item) {
      item = { pageid: page.pageid ?? 0, title: page.title };
      pages.set(page.title, item);
    }

    if (typeof page.extract === "string" && page.extract.length > 0) {
      item.extract = page.extract;
    }
    if (page.categories) {
      item.categories = mergeTitles(item.categories, page.categories);
    }
    if (page.redirects) {
      item.redirects = mergeTitles(item.redirects, page.redirects);
    }
  }
}

function mergeTitles(
  existing: string[] | undefined,
  incoming: { title?: string }[]
): string[] {
  const titles = incoming
    .map((it) => it.title)
    .filter((title): title is string => typeof title === "string");
  return existing ? [...new Set([...existing, ...titles])] : titles;
}

/**
 * Builder around {@link queryPages}, kept for backwards compatibility.
 *
 * Only `titles` and `redirects` are read from the raw query string; the other
 * MediaWiki parameters are managed by {@link queryPages}, which batches and
 * pages through continuations. Prefer calling `queryPages` directly.
 *
 * @example
 * const pages = await new Api().extract(2).redirects().query("en", { titles: "Europe" });
 */
export class Api {
  private options: Partial<QueryPagesOptions> = {};

  constructor(
    private qs: StringPlainObject = {},
    private httpTimeout?: number
  ) {
    this.qs = { ...qs };
  }

  /** Request `sentences` sentences of the lead section. */
  extract(sentences = 3): this {
    this.options.extract = sentences;
    return this;
  }

  /** Request the titles of articles redirecting to each page. */
  redirects(): this {
    this.options.redirects = true;
    return this;
  }

  /** Request each article's non hidden categories. */
  categories(): this {
    this.options.categories = true;
    return this;
  }

  /** Run the query. `qs` may carry `titles` (pipe separated) and `redirects`. */
  async query(lang: string, qs?: StringPlainObject): Promise<ApiResult[]> {
    if (qs) this.qs = { ...this.qs, ...qs };

    const titles = (this.qs["titles"] ?? "")
      .split("|")
      .map((title) => title.trim())
      .filter((title) => title.length > 0);

    const result = await queryPages({
      lang,
      titles,
      ...this.options,
      followRedirects:
        this.options.followRedirects ?? this.qs["redirects"] === "yes",
      ...(this.httpTimeout === undefined
        ? {}
        : { httpTimeout: this.httpTimeout })
    });

    return result.pages;
  }
}

/** Fetch the lead extract of several articles at once. */
export async function getExtracts(
  params: ExtractsParamsType
): Promise<ExtractType[]> {
  const { pages } = await queryPages({
    lang: params.lang,
    titles: params.titles,
    extract: params.sentences ?? 3,
    followRedirects: true,
    ...(params.httpTimeout === undefined
      ? {}
      : { httpTimeout: params.httpTimeout }),
    ...(params.signal === undefined ? {} : { signal: params.signal })
  });

  return pages
    .filter((page) => typeof page.extract === "string")
    .map((page) => ({
      pageid: page.pageid,
      title: page.title,
      extract: page.extract as string
    }));
}

/** Fetch the lead extract of a single article. */
export async function getExtract(
  lang: string,
  title: string,
  sentences?: number
): Promise<ExtractType | null> {
  const extracts = await getExtracts({
    lang,
    titles: [title],
    ...(sentences === undefined ? {} : { sentences })
  });
  return extracts[0] ?? null;
}

/** Fetch the titles of every article redirecting to `title`. */
export async function getRedirects(
  lang: string,
  title: string
): Promise<string[]> {
  const { pages } = await queryPages({
    lang,
    titles: [title],
    redirects: true,
    followRedirects: true
  });
  return pages[0]?.redirects ?? [];
}
