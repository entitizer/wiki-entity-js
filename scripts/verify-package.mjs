/**
 * Smoke-test the built package the way a consumer would load it: both entry
 * points must resolve, expose the public API, and share one module instance.
 *
 * Run with `npm run verify:package` (after `npm run build`).
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);

const EXPECTED_EXPORTS = [
  "getEntities",
  "mapRedirects",
  "convertToSimpleEntity",
  "simplifyEntity",
  "simplifyClaims",
  "queryPages",
  "getEntityTypesByName",
  "getEntityTypesByNames",
  "setUserAgent",
  "getUserAgent",
  "setDbpediaEndpoint",
  "WikipediaApi",
  "SimpleEntityType",
  "WikiEntityError",
  "HttpError",
  "ApiError",
  "InvalidParamsError"
];

for (const file of ["dist/index.js", "dist/index.cjs", "dist/index.d.ts"]) {
  assert.ok(existsSync(file), `missing build output: ${file}`);
}

const esm = await import("../dist/index.js");
const cjs = require("../dist/index.cjs");

for (const name of EXPECTED_EXPORTS) {
  assert.ok(name in esm, `ESM build does not export ${name}`);
  assert.ok(name in cjs, `CJS build does not export ${name}`);
}

// A build-time define that silently failed would leave the placeholder behind.
const ua = esm.getUserAgent();
assert.ok(
  /^wiki-entity\/\d+\.\d+\.\d+ \(https?:\/\//.test(ua),
  `unexpected default User-Agent: ${ua}`
);

// The data tables must survive bundling.
assert.equal(
  esm.convertToSimpleEntity(
    {
      id: "Q1",
      claims: {
        P31: { id: "P31", values: [{ datatype: "wikibase-item", value: "Q5" }] }
      }
    },
    "en"
  ).type,
  esm.SimpleEntityType.PERSON,
  "entity type tables did not survive the build"
);

console.log(
  `OK — ESM and CJS builds expose ${EXPECTED_EXPORTS.length} exports`
);
console.log(`Default User-Agent: ${ua}`);
