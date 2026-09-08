# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## 1.0.0

A full modernization pass: the package is now dependency-free, dual ESM/CJS,
strictly typed, and covered by a real test suite. Several long-standing data
bugs are fixed, and the generated Wikidata tables have been rebuilt.

### Breaking changes

- **Node.js >= 20.19 is required.** `axios` is gone; the package uses the
  platform `fetch`.
- **Dual ESM/CommonJS build.** The package now has an `exports` map and ships
  from `dist/`. Deep imports such as
  `require("wiki-entity/lib/simpleEntity/getEntityCountry")` no longer resolve —
  everything is exported from the package root instead
  (`getEntityCountryCode`, `getEntityData`, `getEntityTypeByExtract`, …).
- **`pageid` now always means the Wikipedia page id.** It used to fall back to
  Wikidata's own page id whenever the Wikipedia lookup was skipped
  (`wikiPageId: false`, no sitelink, missing article), which silently produced a
  wrong `wikiPageId` in `SimpleEntity`. It is now left unset in those cases.
- **Deprecated statements are dropped** and **preferred statements sort first**,
  so `claims[p].values[0]` is the value Wikidata recommends. Pass
  `keepDeprecatedClaims` to `simplifyEntity` to keep them.
- **`wikibase-property` claim values** are now the property id (`"P31"`) rather
  than the raw Wikibase object, which used to stringify to `"[object Object]"`.
- `simplifySitelinks` and friends return `{}` instead of `null` for empty input.
- `convertToSimpleEntity` omits empty optional fields (`categories`, `data`,
  `types`) instead of setting them to `[]`/`{}`.
- `getEntityType`, `getEntityTypeByExtract` and related helpers return
  `undefined` rather than `null` when nothing matches.
- `getManyEntities` returns `{}` instead of `null` when nothing was found —
  the `null` used to crash the caller.

### Fixed

- **Labels went missing for a large share of items.** Wikidata has been moving
  names that are identical across languages to the `mul` ("multiple languages")
  code and deleting the per-language duplicates, which left `label` undefined
  for entities such as Albert Einstein, Douglas Adams and iPhone 5. Labels and
  aliases now fall back to `mul`, and `mul` is requested automatically alongside
  any `languages` filter.
- **Only the first entity got an extract.** Without `exintro`, MediaWiki
  silently lowers `exlimit` to 1, so `getEntities({ titles: [a, b, c], extract })`
  returned an extract for `a` only.
- **`languages` was ignored.** It was serialized as PHP array syntax
  (`languages[]=en&languages[]=ru`), which MediaWiki rejects with a warning and
  then returns _every_ language for.
- **BCE dates lost their sign.** `-0044-03-15` (Julius Caesar's death) rendered
  as `0044-03-15`.
- **Coordinates lost integer digits.** Trailing-zero trimming turned latitude
  `10` into `1`.
- **`claims: "property"` never worked.** Property entities (`P31`, …) were
  filtered out as invalid ids, so property labels and descriptions were never
  populated.
- **The `types` prefix filter was ignored.** `types: ["dbo", "schema"]` computed
  the allowed prefixes and then never applied them.
- **Wikipedia results were mismatched to entities.** MediaWiki normalizes titles
  and follows redirects, so the returned title often differs from the requested
  one; results are now mapped back through the normalization and redirect
  chains. Previously this attached data to the wrong entity, or threw.
- **Titles that are redirects found no entity.** Single-title lookups now use
  `normalize=1`, and multi-title lookups resolve anything Wikidata missed
  through Wikipedia's canonical title.
- **Romanian extract patterns never matched.** They relied on `\b`, which is
  ASCII-only, so words ending in a diacritic (`oraș`, `cântăreț`, `comună`)
  could never match. Patterns are now Unicode-aware; English patterns added.
- More than 50 Wikipedia titles are now batched instead of being sent in one
  over-long request, and paginated (`continue`) responses are followed, so
  `redirects` and `categories` are no longer truncated at the first page.
- `getEntityData` no longer throws on a structured claim value with no readable
  rendering; it skips it.
- DBpedia is queried over HTTPS, with the resource IRI properly escaped.

### Added

- `AbortSignal` support on every public call (`signal` param).
- Automatic retries with exponential backoff and jitter on 429/5xx/network
  errors, honouring `Retry-After`.
- Typed error classes: `WikiEntityError`, `HttpError`, `ApiError`,
  `InvalidParamsError`.
- `getEntityTypesByNames()` resolves DBpedia types for many entities in a single
  `VALUES` query instead of one request per entity.
- `queryPages()` — the batching, continuation-following Wikipedia query used
  internally, exported for direct use.
- `setDbpediaEndpoint()` / `getDbpediaEndpoint()` to use a DBpedia mirror.
- `rank` on claim values; `descriptions` map on entities; `datatype` on property
  entities.
- `chunk`, `isItemId`, `isPropertyId`, `isEntityId` utilities.
- Unit tests (fully mocked) and an integration suite that runs against the live
  APIs, plus ESLint, Prettier and strict TypeScript.

### Changed

- **Claim resolution is batched.** `claims: "item"` used to issue one request
  per entity, serially; all referenced items across all entities are now fetched
  together, 50 per request.
- **Regenerated `data/entity-types.json` and `data/countries.json`** from the
  live Wikidata Query Service. The type tables dated from 2018 and missed how
  Wikidata now models products, recurring events and administrative entities.
  The generator expands the class graph breadth-first with batched queries, and
  verifies known classifications before writing.
- The type table is delta-encoded, cutting it from 456 KB to ~130 KB and
  expanding lazily on first use.
- `isValidWikiId` is deprecated in favour of `isItemId` / `isEntityId`.

## 0.7.0

- Added a default `User-Agent` built from `package.json`, plus `setUserAgent()`
  and the `WIKI_ENTITY_USER_AGENT` environment variable.

## 0.6.0

- Added `mapRedirects()`.
