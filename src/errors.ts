/** Base class for every error thrown by this package. */
export class WikiEntityError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A transport level failure: non 2xx status, network error or timeout. */
export class HttpError extends WikiEntityError {
  /** Milliseconds requested by a `Retry-After` response header, if any. */
  readonly retryAfter: number | undefined;

  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
    options?: { cause?: unknown; retryAfter?: number }
  ) {
    super(message, options);
    this.retryAfter = options?.retryAfter;
  }

  /**
   * `true` when retrying the very same request may succeed: rate limiting,
   * server errors and transport failures.
   */
  get retryable(): boolean {
    if (this.status === undefined) return true;
    return this.status === 429 || this.status >= 500;
  }
}

/** The request succeeded but the MediaWiki/SPARQL endpoint reported an error. */
export class ApiError extends WikiEntityError {
  constructor(
    message: string,
    readonly code?: string,
    readonly url?: string
  ) {
    super(message);
  }
}
