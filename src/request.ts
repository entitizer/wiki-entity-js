import { ApiError, HttpError } from "./errors";

/**
 * Value types accepted for a query string parameter. Arrays are joined with
 * `|`, which is what the MediaWiki API expects for multi valued parameters.
 * `undefined` and `null` parameters are dropped.
 */
export type QueryParamValue =
  string | number | boolean | readonly string[] | undefined | null;

export type QueryParams = Record<string, QueryParamValue>;

export interface RequestOptions {
  /** Query string parameters. Arrays are joined with `|`. */
  params?: QueryParams;
  /** Per request timeout in milliseconds. Default: 15000. */
  timeout?: number;
  /** Extra request headers. `User-Agent` is set automatically. */
  headers?: Record<string, string>;
  /** Caller supplied cancellation signal. */
  signal?: AbortSignal | undefined;
  /**
   * How many times a retryable failure (429, 5xx, network error) is retried.
   * Default: 2.
   */
  retries?: number;
}

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 2;
const RETRY_BASE_DELAY = 500;
const MAX_RETRY_DELAY = 20_000;

/**
 * Wikimedia's User-Agent policy requires a descriptive UA with a contact URL.
 * Generic agents are throttled or blocked outright.
 *
 * @see https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
 */
const DEFAULT_USER_AGENT = buildDefaultUserAgent();

/**
 * The package identity is inlined at build time. Running the sources directly
 * (tsx, ts-node) leaves the placeholders undefined, so fall back to a literal.
 */
function buildDefaultUserAgent(): string {
  const name = typeof __PKG_NAME__ === "string" ? __PKG_NAME__ : "wiki-entity";
  const version =
    typeof __PKG_VERSION__ === "string" ? __PKG_VERSION__ : "0.0.0-dev";
  const homepage =
    typeof __PKG_HOMEPAGE__ === "string"
      ? __PKG_HOMEPAGE__
      : "https://github.com/entitizer/wiki-entity";
  return `${name}/${version} (${homepage})`;
}

let userAgent = process.env["WIKI_ENTITY_USER_AGENT"] || DEFAULT_USER_AGENT;

/**
 * Override the `User-Agent` sent with every request. Wikimedia asks clients to
 * identify themselves with an app name and a contact URL or e-mail.
 *
 * @example
 * setUserAgent("MyApp/1.0 (https://myapp.example; me@myapp.example)");
 */
export function setUserAgent(ua: string): void {
  if (typeof ua !== "string" || ua.trim().length === 0) {
    throw new TypeError("User-Agent must be a non-empty string");
  }
  userAgent = ua.trim();
}

/** The `User-Agent` currently sent with every request. */
export function getUserAgent(): string {
  return userAgent;
}

export function buildSearchParams(params: QueryParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      // The MediaWiki API takes multi valued params as a single pipe separated
      // string; PHP array syntax (`key[]=a&key[]=b`) is rejected with a warning.
      if (value.length === 0) continue;
      search.set(key, value.join("|"));
    } else {
      search.set(key, String(value));
    }
  }
  return search;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

function abortError(signal?: AbortSignal): Error {
  const reason: unknown = signal?.reason;
  return reason instanceof Error
    ? reason
    : new Error("Request aborted", { cause: reason });
}

/** Honour `Retry-After`, which is either a delay in seconds or an HTTP date. */
function retryAfterDelay(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - Date.now());
}

function backoffDelay(attempt: number): number {
  const exponential = RETRY_BASE_DELAY * 2 ** attempt;
  // Full jitter, so concurrent callers do not retry in lockstep.
  return Math.min(MAX_RETRY_DELAY, exponential) * (0.5 + Math.random() * 0.5);
}

/**
 * `GET` a JSON document, with a timeout and bounded retries on transient
 * failures. Exported for internal use; prefer the high level API functions.
 */
export async function request<T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    params,
    timeout = DEFAULT_TIMEOUT,
    headers,
    signal,
    retries = DEFAULT_RETRIES
  } = options;

  const target = new URL(url);
  if (params) {
    for (const [key, value] of buildSearchParams(params)) {
      target.searchParams.set(key, value);
    }
  }
  const href = target.toString();

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay =
        lastError instanceof HttpError && lastError.retryAfter !== undefined
          ? lastError.retryAfter
          : backoffDelay(attempt - 1);
      await sleep(delay, signal);
    }

    const timeoutSignal = AbortSignal.timeout(timeout);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(href, {
        method: "GET",
        redirect: "follow",
        signal: requestSignal,
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          ...headers
        }
      });
    } catch (cause) {
      // A caller supplied abort is final; a timeout or network blip is not.
      if (signal?.aborted) throw abortError(signal);
      lastError = new HttpError(
        `Request to ${href} failed: ${(cause as Error).message}`,
        href,
        undefined,
        { cause }
      );
      continue;
    }

    if (!response.ok) {
      const error = new HttpError(
        `Request to ${href} failed with status ${response.status} ${response.statusText}`,
        href,
        response.status,
        { retryAfter: retryAfterDelay(response) }
      );
      if (!error.retryable) throw error;
      lastError = error;
      continue;
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(
        `Response from ${href} is not valid JSON`,
        "invalid-json",
        href
      );
    }
  }

  throw lastError;
}

export default request;
