import request from "../request";
import type { StringPlainObject } from "../types";

/**
 * Ontology namespaces recognised in DBpedia `rdf:type` values, mapped to the
 * short prefix used in `WikiEntity.types`.
 */
const PREFIXES_MAP: StringPlainObject = {
  "http://www.ontologydesignpatterns.org/ont/dul/DUL.owl#": "dul",
  "http://dbpedia.org/ontology/": "dbo",
  "http://www.w3.org/2002/07/owl#": "owl",
  "http://www.wikidata.org/entity/": "wikidata",
  "http://schema.org/": "schema",
  "https://schema.org/": "schema",
  "http://xmlns.com/foaf/0.1/": "foaf",
  "http://www.w3.org/2003/01/geo/wgs84_pos#": "geo"
};

const PREFIXES_REG = new RegExp(
  `^(${Object.keys(PREFIXES_MAP)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})`
);

/** Every prefix this package can return in `WikiEntity.types`. */
export const KNOWN_TYPE_PREFIXES: string[] = [
  ...new Set(Object.values(PREFIXES_MAP))
];

let endpoint = "https://dbpedia.org/sparql";

/**
 * Point type lookups at a different SPARQL endpoint (a DBpedia mirror, or a
 * local Virtuoso instance).
 */
export function setDbpediaEndpoint(url: string): void {
  if (typeof url !== "string" || url.trim().length === 0) {
    throw new TypeError("DBpedia endpoint must be a non-empty URL");
  }
  endpoint = url.trim();
}

export function getDbpediaEndpoint(): string {
  return endpoint;
}

interface SparqlResponse {
  results?: {
    bindings?: { s?: { value?: string }; type?: { value?: string } }[];
  };
}

/** DBpedia rejects very long queries; keep each batch small enough to pass. */
const MAX_NAMES_PER_QUERY = 25;

export interface EntityTypesOptions {
  /** Keep only these prefixes, e.g. `["dbo", "schema"]`. Default: all of them. */
  prefixes?: string[] | undefined;
  httpTimeout?: number;
  signal?: AbortSignal;
}

/**
 * Look up the ontology types DBpedia assigns to an English Wikipedia article.
 *
 * Returns prefixed types such as `schema:City` or `dbo:Person`. Throws when the
 * endpoint is unreachable; callers that treat types as optional enrichment
 * should catch.
 */
export async function getEntityTypesByName(
  name: string,
  prefixesOrOptions?: string[] | EntityTypesOptions
): Promise<string[]> {
  const types = await getEntityTypesByNames([name], prefixesOrOptions);
  return types.get(name) ?? [];
}

/**
 * Look up ontology types for several English Wikipedia titles at once.
 *
 * Resolving them one request per entity floods the public DBpedia endpoint, so
 * the titles are batched into a single `VALUES` query per group.
 *
 * @returns A map keyed by the passed-in names. Names DBpedia knows nothing
 * about are absent from the map.
 */
export async function getEntityTypesByNames(
  names: readonly string[],
  prefixesOrOptions?: string[] | EntityTypesOptions
): Promise<Map<string, string[]>> {
  const options: EntityTypesOptions = Array.isArray(prefixesOrOptions)
    ? { prefixes: prefixesOrOptions }
    : (prefixesOrOptions ?? {});

  const allowed =
    options.prefixes && options.prefixes.length > 0
      ? new Set(options.prefixes)
      : null;

  const nameOfIri = new Map<string, string>();
  for (const name of names) {
    if (typeof name === "string" && name.trim().length > 0) {
      nameOfIri.set(toResourceIri(name), name);
    }
  }

  const result = new Map<string, string[]>();
  if (nameOfIri.size === 0) return result;

  const iris = [...nameOfIri.keys()];
  const raw = new Map<string, Set<string>>();

  for (const group of chunkIris(iris, MAX_NAMES_PER_QUERY)) {
    for (const [iri, type] of await queryTypes(group, options)) {
      const set = raw.get(iri);
      if (set) set.add(type);
      else raw.set(iri, new Set([type]));
    }
  }

  for (const [iri, types] of raw) {
    const name = nameOfIri.get(iri);
    if (name === undefined) continue;
    result.set(name, repairTypes(prefixTypes(types, allowed)));
  }

  return result;
}

function prefixTypes(
  types: Iterable<string>,
  allowed: ReadonlySet<string> | null
): string[] {
  const prefixed: string[] = [];
  for (const type of types) {
    const match = PREFIXES_REG.exec(type);
    const namespace = match?.[1];
    if (!namespace) continue;
    const prefix = PREFIXES_MAP[namespace];
    if (!prefix) continue;
    if (allowed && !allowed.has(prefix)) continue;
    prefixed.push(`${prefix}:${type.slice(namespace.length)}`);
  }
  return [...new Set(prefixed)];
}

function chunkIris(iris: string[], size: number): string[][] {
  const groups: string[][] = [];
  for (let i = 0; i < iris.length; i += size) {
    groups.push(iris.slice(i, i + size));
  }
  return groups;
}

/** @returns `[resourceIri, typeIri]` pairs. */
async function queryTypes(
  iris: readonly string[],
  options: EntityTypesOptions
): Promise<[string, string][]> {
  const values = iris.map((iri) => `<${iri}>`).join(" ");
  const data = await request<SparqlResponse>(endpoint, {
    params: {
      query: `SELECT DISTINCT ?s ?type WHERE { VALUES ?s { ${values} } ?s rdf:type ?type }`,
      format: "application/sparql-results+json"
    },
    headers: { Accept: "application/sparql-results+json" },
    timeout: options.httpTimeout ?? 30_000,
    signal: options.signal
  });

  const pairs: [string, string][] = [];
  for (const binding of data.results?.bindings ?? []) {
    const subject = binding.s?.value;
    const type = binding.type?.value;
    if (typeof subject === "string" && typeof type === "string") {
      pairs.push([subject, type]);
    }
  }
  return pairs;
}

// Characters that may not appear literally inside a SPARQL `<IRI>`: control
// characters and space, plus the delimiters that would terminate the IRI.
// eslint-disable-next-line no-control-regex
const IRI_ILLEGAL = /[\u0000-\u0020<>"{}|\\^`%]/g;

/** Build the DBpedia resource IRI for an English Wikipedia article title. */
export function toResourceIri(name: string): string {
  const local = name.trim().replace(/\s+/g, "_");
  const escaped = local.replace(
    IRI_ILLEGAL,
    (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
  );
  return `http://dbpedia.org/resource/${escaped}`;
}

/**
 * DBpedia routinely types settlements as both a Place and a Person, via
 * mis-mapped infoboxes. When both show up, the Place wins.
 */
function repairTypes(types: string[]): string[] {
  const hasPlace = types.some((type) => /:Place$/.test(type));
  if (!hasPlace) return types;
  return types.filter((type) => !/:Person$/.test(type));
}
