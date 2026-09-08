# wiki-entity

Fetch and normalize entities from **Wikidata**, **Wikipedia** and **DBpedia**.

- Zero runtime dependencies — built on `fetch`, ESM + CommonJS, fully typed.
- Batches, retries and rate-limit aware by default.
- Flattens Wikidata's deeply nested claim format into something you can read.

```bash
npm install wiki-entity
```

Requires Node.js >= 20.19.

## Usage

```ts
import { getEntities, setUserAgent } from "wiki-entity";

setUserAgent("MyApp/1.0 (https://myapp.example; contact@myapp.example)");

// by Wikipedia article title
const [europe] = await getEntities({ language: "en", titles: ["Europe"] });

// by Wikidata id, with a Wikipedia summary and resolved claim labels
const [einstein] = await getEntities({
  language: "en",
  ids: ["Q937"],
  extract: 2,
  claims: "all"
});

einstein.label; // "Albert Einstein"
einstein.extract; // "Albert Einstein was a German-born theoretical physicist…"
einstein.claims.P569.label; // "date of birth"
einstein.claims.P569.values[0].value_string; // "1879-03-14"
```

CommonJS works too:

```js
const { getEntities } = require("wiki-entity");
```

## User-Agent

[Wikimedia's User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy)
requires every client to identify itself. Generic agents get throttled or
blocked with HTTP `429`. Set yours once at startup:

```ts
import { setUserAgent } from "wiki-entity";

setUserAgent("MyApp/1.0 (https://myapp.example; contact@myapp.example)");
```

or via the environment:

```bash
WIKI_ENTITY_USER_AGENT="MyApp/1.0 (https://myapp.example; contact@myapp.example)"
```

## API

### `getEntities(params): Promise<WikiEntity[]>`

Fetches entities from Wikidata and enriches them from Wikipedia and DBpedia.
Results follow the order of the requested `ids`/`titles`; entities that do not
exist are omitted.

| Param                   | Type                  | Default | Description                                                                                    |
| ----------------------- | --------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `ids`                   | `string[]`            | —       | Wikidata ids, max 500. Either this or `titles` is required.                                    |
| `titles`                | `string[]`            | —       | Wikipedia article titles in `language`, max 500.                                               |
| `language`              | `string`              | `"en"`  | Language of `titles` and of the resulting `label`/`description`.                               |
| `languages`             | `string[]`            | —       | Extra languages to populate `labels` with.                                                     |
| `props`                 | `string[]`            | all     | `info`, `sitelinks`, `aliases`, `labels`, `descriptions`, `claims`, `datatype`.                |
| `claims`                | `string`              | `none`  | `none`, `item`, `property` or `all` — how deeply to resolve claim labels.                      |
| `extract`               | `number`              | —       | Sentences of the Wikipedia lead section to fetch.                                              |
| `types`                 | `boolean \| string[]` | `false` | `true` for DBpedia ontology types, or an array of prefixes to keep (e.g. `["dbo", "schema"]`). |
| `redirects`             | `boolean`             | `false` | Titles of _Wikipedia articles_ that redirect to this entity.                                   |
| `categories`            | `boolean`             | `false` | The article's non-hidden categories.                                                           |
| `wikiPageId`            | `boolean`             | `true`  | Fetch the Wikipedia `pageid`.                                                                  |
| `httpTimeout`           | `number`              | `15000` | Per-request timeout in milliseconds.                                                           |
| `signal`                | `AbortSignal`         | —       | Cancels every underlying request.                                                              |
| `followEntityRedirects` | `boolean`             | `true`  | Resolve _Wikidata items_ that were merged into another item.                                   |

`extract`, `redirects` and `categories` need the entity to have a sitelink for
`language`, so keep `sitelinks` in `props` when you narrow it.

Note `redirects` and `followEntityRedirects` are unrelated: the first fetches
the titles of Wikipedia articles pointing at this entity, the second controls
whether a merged-away Wikidata item resolves to the item that replaced it.

### `mapRedirects(titles, lang): Promise<Record<string, string>>`

Resolves Wikipedia redirect titles to the articles they point at. Only titles
that really are redirects appear in the result.

```ts
await mapRedirects(["Brashov"], "ro"); // { Brashov: "Brașov" }
```

### `convertToSimpleEntity(wikiEntity, lang, options?): SimpleEntity`

Flattens a `WikiEntity` into a compact, storage-friendly shape.

### Escape hatches

For what `getEntities` does not cover. Everything else in the package is an
implementation detail and may change without a major release.

| Export                                      | Purpose                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| `simplifyEntity(lang, raw, options?)`       | Flatten a raw `wbgetentities` entity you fetched yourself.      |
| `queryPages(options)`                       | Query Wikipedia articles directly — batched, continuation-safe. |
| `getEntityTypesByNames(names, options?)`    | DBpedia ontology types for English Wikipedia titles.            |
| `setDbpediaEndpoint` / `getDbpediaEndpoint` | Point type lookups at a DBpedia mirror.                         |
| `setUserAgent` / `getUserAgent`             | The `User-Agent` sent with every request.                       |

### Errors

All errors extend `WikiEntityError`:

- `HttpError` — non-2xx status, network failure or timeout. `status`, `url` and
  `retryable` describe it; 429 and 5xx are retried automatically.
- `ApiError` — the request succeeded but MediaWiki reported an error (`code`).

Bad arguments throw a plain `TypeError`.

DBpedia types are best-effort enrichment: if the endpoint is unreachable,
`types` is simply left unset instead of failing the call.

## WikiEntity

`WikiEntity` is a flattened Wikidata item, plus the extras pulled from
Wikipedia and DBpedia.

```ts
type WikiEntity = {
  id: string;
  label?: string;
  labels?: Record<string, string>;
  description?: string;
  descriptions?: Record<string, string>;
  aliases?: string[];
  sitelinks?: Record<string, string>;
  claims?: Record<string, WikidataProperty>;
  /** Wikipedia page id (not Wikidata's). */
  pageid?: number;
  extract?: string;
  types?: string[];
  redirects?: string[];
  categories?: string[];
  redirectsToId?: string;
  redirectsFromId?: string;
};

type WikidataProperty = {
  id: string;
  label?: string;
  description?: string;
  values: WikidataPropertyValue[];
};

type WikidataPropertyValue = {
  datatype: string;
  /** Scalar for simple datatypes, the raw object for time/quantity/coordinates. */
  value: string | number | object;
  /** Readable rendering of a structured `value`. */
  value_string?: string;
  rank?: "preferred" | "normal" | "deprecated";
  label?: string;
  description?: string;
  qualifiers?: Record<string, WikidataProperty> | null;
};
```

Notes on the claim values:

- Statements Wikidata marks **deprecated** are dropped, and **preferred** ones
  are sorted first, so `values[0]` is the value Wikidata recommends.
- Dates render at their stated precision and keep the sign of BCE years:
  `-0044-03-15`.
- Coordinates render as `"47.0105,28.8638"`.
- Labels fall back to Wikidata's `mul` ("multiple languages") code, which is
  where many items now keep a name that is spelled the same everywhere.

## SimpleEntity

```ts
enum SimpleEntityType {
  EVENT = "E",
  ORG = "O",
  PERSON = "H",
  PLACE = "P",
  PRODUCT = "R",
  WORK = "W"
}

type SimpleEntity = {
  lang?: string;
  wikiDataId?: string;
  name?: string;
  abbr?: string;
  description?: string;
  about?: string;
  wikiPageId?: number;
  wikiPageTitle?: string;
  type?: SimpleEntityType;
  types?: string[];
  countryCodes?: string[];
  data?: Record<string, string[]>;
  categories?: string[];
  redirectsToId?: string;
  redirectsFromId?: string;
};
```

The entity `type` is resolved from the DBpedia ontology types first, then from
the `P31` claims against the generated Wikidata class tables, and finally from
the opening words of the extract.

## Generated data

`data/countries.json` and `data/entity-types.json` are derived from Wikidata
and checked in. Regenerate them against the live query service with:

```bash
npm run data:countries
npm run data:entity-types
```

`data:entity-types` verifies a set of known classifications before writing, so
a bad expansion fails loudly instead of silently degrading type detection.

## Development

```bash
npm install
npm test              # unit tests, fully mocked
npm run test:integration   # hits the live Wikimedia and DBpedia APIs
npm run check         # format, lint, typecheck, test, build
```

## License

ISC
