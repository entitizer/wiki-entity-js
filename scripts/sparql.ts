/** Shared helpers for the data generation scripts. */

export const WDQS_ENDPOINT = "https://query.wikidata.org/sparql";

const USER_AGENT =
  process.env["WIKI_ENTITY_USER_AGENT"] ??
  "wiki-entity-datagen/1.0 (https://github.com/entitizer/wiki-entity)";

export interface SparqlBinding {
  [variable: string]: { value?: string; type?: string; datatype?: string };
}

export interface SparqlOptions {
  endpoint?: string;
  timeout?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a SPARQL query, retrying on the timeouts and rate limits the public
 * Wikidata endpoint hands out under load.
 */
export async function sparql(
  query: string,
  options: SparqlOptions = {}
): Promise<SparqlBinding[]> {
  const { endpoint = WDQS_ENDPOINT, timeout = 300_000, retries = 4 } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(60_000, 2_000 * 2 ** (attempt - 1));
      console.warn(`  retry ${attempt}/${retries} in ${delay / 1000}s …`);
      await sleep(delay);
    }

    try {
      const url = new URL(endpoint);
      url.searchParams.set("query", query);
      url.searchParams.set("format", "json");

      const response = await fetch(url, {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": USER_AGENT
        },
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        results?: { bindings?: SparqlBinding[] };
      };
      return data.results?.bindings ?? [];
    } catch (error) {
      lastError = error;
      console.warn(`  query failed: ${(error as Error).message}`);
    }
  }

  throw lastError;
}

/** Extract the local id (`Q42`) from a `http://www.wikidata.org/entity/Q42` IRI. */
export function entityIdOf(iri: string | undefined): string | undefined {
  if (!iri) return undefined;
  const id = iri.slice(iri.lastIndexOf("/") + 1);
  return /^[QP][1-9]\d*$/.test(id) ? id : undefined;
}
