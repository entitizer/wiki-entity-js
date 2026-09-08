/**
 * Regenerate `data/countries.json`: every Wikidata item that is a country and
 * carries both ISO 3166-1 alpha-2 and alpha-3 codes.
 *
 * Run with `npm run data:countries`.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { entityIdOf, sparql } from "./sparql";

const OUT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../data/countries.json"
);

/**
 * Q6256 country, Q3624078 sovereign state, Q1763527 constituent country and
 * Q161243 dependent territory: between them these cover the ISO 3166-1 list,
 * including territories a "country" query alone would miss.
 */
const COUNTRY_CLASSES = ["Q6256", "Q3624078", "Q1763527", "Q161243"];

const QUERY = `
SELECT DISTINCT ?item ?cc2 ?cc3 WHERE {
  VALUES ?class { ${COUNTRY_CLASSES.map((id) => `wd:${id}`).join(" ")} }
  ?item wdt:P31 ?class ;
        wdt:P297 ?cc2 ;
        wdt:P298 ?cc3 .
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
}
ORDER BY ?cc2`;

interface CountryRecord {
  id: string;
  cc2: string;
  cc3: string;
}

async function main(): Promise<void> {
  console.log("Querying Wikidata for countries …");
  const bindings = await sparql(QUERY);

  const data: Record<string, CountryRecord> = {};
  const seenCc2 = new Map<string, string>();

  for (const binding of bindings) {
    const id = entityIdOf(binding["item"]?.value);
    const cc2 = binding["cc2"]?.value?.toUpperCase();
    const cc3 = binding["cc3"]?.value?.toUpperCase();
    if (!id || !cc2 || !cc3) continue;
    if (!/^[A-Z]{2}$/.test(cc2) || !/^[A-Z]{3}$/.test(cc3)) continue;

    // A code claimed by two items means a data conflict upstream; keep the
    // first and report it rather than silently picking a winner.
    const owner = seenCc2.get(cc2);
    if (owner && owner !== id) {
      console.warn(
        `  ${cc2} claimed by both ${owner} and ${id}; keeping ${owner}`
      );
      continue;
    }
    seenCc2.set(cc2, id);

    data[id] = { id, cc2, cc3 };
  }

  const sorted = Object.fromEntries(
    Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
  );

  writeFileSync(OUT_FILE, JSON.stringify(sorted), "utf8");
  console.log(`Wrote ${Object.keys(sorted).length} countries to ${OUT_FILE}`);

  for (const cc of ["US", "GB", "DE", "FR", "MD", "RO", "CH", "JP"]) {
    if (!seenCc2.has(cc)) console.warn(`  WARNING: ${cc} is missing`);
  }
}

await main();
