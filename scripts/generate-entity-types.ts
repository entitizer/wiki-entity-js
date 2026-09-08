/**
 * Regenerate `data/entity-types.json`: for each `SimpleEntityType`, the
 * Wikidata classes whose instances belong to that category.
 *
 * Wikidata's `P279` graph is noisy — an unbounded `wdt:P279*` closure of
 * "intellectual work" alone reaches ~240k classes and swallows the ontology —
 * so each seed is expanded breadth-first to a fixed depth. Every level is one
 * batched query rather than one query per class.
 *
 * Run with `npm run data:entity-types`.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SimpleEntityType } from "../src/simple-entity/simple-entity";
import { entityIdOf, sparql } from "./sparql";

const OUT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../data/entity-types.json"
);

/** Classes whose subtrees are irrelevant here and would drag in the world. */
const EXCLUDED = new Set([
  "Q3249551", // process
  "Q958314", // varietal
  "Q12737077", // occupation
  "Q4164871", // position
  "Q214339", // role
  "Q23958852" // variable-order class
]);

/**
 * A class to expand down the `P279` (subclass of) graph, with its own depth.
 *
 * Depth is per seed because Wikidata's class graph is wildly uneven: "human"
 * stays tidy for many levels, while "product" reaches 200k classes at depth 3.
 */
interface Seed {
  id: string;
  depth: number;
  /** What the class is, and why this depth. */
  note: string;
}

const CONFIG: Record<SimpleEntityType, Seed[]> = {
  [SimpleEntityType.EVENT]: [
    { id: "Q1656682", depth: 3, note: "event" },
    { id: "Q15275719", depth: 2, note: "recurring event" },
    // Wikidata models each staging of a recurring competition as an "edition";
    // without this, UEFA Euro 2016 and friends resolve to no type at all.
    { id: "Q27968055", depth: 3, note: "recurring event edition" },
    { id: "Q16510064", depth: 2, note: "sporting event" }
  ],
  [SimpleEntityType.PERSON]: [{ id: "Q5", depth: 3, note: "human" }],
  [SimpleEntityType.WORK]: [
    { id: "Q15621286", depth: 3, note: "intellectual work" },
    { id: "Q14897293", depth: 3, note: "fictional entity" },
    { id: "Q95074", depth: 3, note: "fictional character" },
    { id: "Q4271324", depth: 3, note: "mythical character" },
    { id: "Q618779", depth: 3, note: "award" }
    // "creative work" (Q17537576) is deliberately absent: at depth 3 it reaches
    // ~174k classes and swallows the rest of the ontology.
  ],
  [SimpleEntityType.ORG]: [
    { id: "Q43229", depth: 4, note: "organization" },
    { id: "Q2001305", depth: 4, note: "television channel" },
    { id: "Q28114677", depth: 4, note: "radio channel" }
  ],
  [SimpleEntityType.PLACE]: [
    { id: "Q17334923", depth: 4, note: "location" },
    { id: "Q1048835", depth: 4, note: "political territorial entity" },
    { id: "Q56061", depth: 4, note: "administrative territorial entity" },
    { id: "Q1370598", depth: 4, note: "place of worship" },
    { id: "Q35145263", depth: 4, note: "natural geographic object" },
    { id: "Q271669", depth: 4, note: "landform" },
    { id: "Q1076486", depth: 4, note: "sports venue" },
    { id: "Q82794", depth: 4, note: "geographic region" },
    { id: "Q294440", depth: 4, note: "public space" },
    { id: "Q41176", depth: 4, note: "building" }
  ],
  [SimpleEntityType.PRODUCT]: [
    // "product" turned into a hub class: 530 subclasses at depth 1, but
    // 203k by depth 3, because books and other works hang off it.
    { id: "Q2424752", depth: 2, note: "product" },
    { id: "Q7397", depth: 3, note: "software" },
    { id: "Q431289", depth: 4, note: "brand" },
    { id: "Q1668024", depth: 4, note: "service on the internet" },
    // Consumer hardware is now modelled as model series grouped under
    // "group of products", which none of the older seeds reach.
    { id: "Q811701", depth: 4, note: "model series" },
    { id: "Q135368721", depth: 4, note: "group of products" }
    // "device" (Q1183543) is deliberately absent: ~38k mostly unrelated
    // classes by depth 4.
  ]
};

/**
 * Detection order, mirroring `SIMPLE_ENTITY_TYPES`: the first type whose class
 * list contains a `P31` value wins, so a class in two lists resolves to the
 * earlier one.
 */
const PRIORITY: SimpleEntityType[] = [
  SimpleEntityType.EVENT,
  SimpleEntityType.PERSON,
  SimpleEntityType.PLACE,
  SimpleEntityType.ORG,
  SimpleEntityType.PRODUCT,
  SimpleEntityType.WORK
];

/**
 * `P31` values of well-known entities, and the category they must resolve to.
 * Regenerating the tables is only safe if these still hold.
 */
const FIXTURES: [classId: string, expected: SimpleEntityType, label: string][] =
  [
    ["Q5", SimpleEntityType.PERSON, "human (Albert Einstein)"],
    ["Q515", SimpleEntityType.PLACE, "city (Chișinău)"],
    ["Q640364", SimpleEntityType.PLACE, "municipality of Romania (Brașov)"],
    ["Q6256", SimpleEntityType.PLACE, "country (Italy)"],
    ["Q43229", SimpleEntityType.ORG, "organization"],
    ["Q891723", SimpleEntityType.ORG, "public company (Meta Platforms)"],
    ["Q1656682", SimpleEntityType.EVENT, "event"],
    [
      "Q107540719",
      SimpleEntityType.EVENT,
      "edition of the UEFA European Championship (Euro 2016)"
    ],
    ["Q9135", SimpleEntityType.PRODUCT, "operating system (Windows 7)"],
    [
      "Q71266741",
      SimpleEntityType.PRODUCT,
      "smartphone model series (iPhone 5)"
    ],
    ["Q7725634", SimpleEntityType.WORK, "literary work"],
    ["Q11424", SimpleEntityType.WORK, "film"]
  ];

/** VALUES clauses beyond this start to time out on the public endpoint. */
const BATCH_SIZE = 200;

/**
 * A category this large means a seed reached a hub class such as "object" and
 * is now describing the whole ontology.
 */
const MAX_CLASSES_PER_TYPE = 60_000;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

/** Direct subclasses per class, shared across seeds so no edge is fetched twice. */
const childrenCache = new Map<string, string[]>();

async function directSubclasses(ids: readonly string[]): Promise<void> {
  const unknown = ids.filter((id) => !childrenCache.has(id));
  if (unknown.length === 0) return;

  for (const group of chunk(unknown, BATCH_SIZE)) {
    // Projecting ?parent lets one query fill the cache for the whole batch.
    const values = group.map((id) => `wd:${id}`).join(" ");
    const rows = await sparql(
      `SELECT DISTINCT ?c ?parent WHERE { VALUES ?parent { ${values} } ?c wdt:P279 ?parent }`
    );

    for (const id of group) childrenCache.set(id, []);

    for (const row of rows) {
      const child = entityIdOf(row["c"]?.value);
      const parent = entityIdOf(row["parent"]?.value);
      if (!child || !parent) continue;
      childrenCache.get(parent)?.push(child);
    }
  }
}

/** Breadth-first expansion down `P279`, one batched query per level. */
async function expandSeed(seed: Seed): Promise<Set<string>> {
  if (EXCLUDED.has(seed.id)) return new Set();

  const found = new Set<string>([seed.id]);
  let frontier = [seed.id];

  for (let level = 0; level < seed.depth && frontier.length > 0; level++) {
    await directSubclasses(frontier);

    const next: string[] = [];
    for (const parent of frontier) {
      for (const child of childrenCache.get(parent) ?? []) {
        // Pruning at the node also prunes everything below it.
        if (EXCLUDED.has(child) || found.has(child)) continue;
        found.add(child);
        next.push(child);
      }
    }
    frontier = next;
  }

  return found;
}

/** Delta encode ascending numeric ids in base 36: "5.1a.3" -> Q5, Q51, Q54. */
function encodeIds(ids: Iterable<string>): string {
  const numbers = [...new Set(ids)]
    .map((id) => Number.parseInt(id.slice(1), 10))
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .sort((a, b) => a - b);

  let previous = 0;
  return numbers
    .map((n) => {
      const delta = n - previous;
      previous = n;
      return delta.toString(36);
    })
    .join(".");
}

function resolveType(
  classId: string,
  tables: Map<SimpleEntityType, Set<string>>
): SimpleEntityType | undefined {
  for (const type of PRIORITY) {
    if (tables.get(type)?.has(classId)) return type;
  }
  return undefined;
}

async function main(): Promise<void> {
  const tables = new Map<SimpleEntityType, Set<string>>();

  for (const [type, seeds] of Object.entries(CONFIG) as [
    SimpleEntityType,
    Seed[]
  ][]) {
    console.log(`\n${type}: expanding ${seeds.length} seeds …`);
    const classes = new Set<string>();

    for (const seed of seeds) {
      const expanded = await expandSeed(seed);
      for (const id of expanded) classes.add(id);
      console.log(
        `    ${seed.id} (${seed.note}, depth ${seed.depth}): ` +
          `${expanded.size} classes -> ${classes.size} total`
      );
    }

    if (classes.size > MAX_CLASSES_PER_TYPE) {
      throw new Error(
        `${type} expanded to ${classes.size} classes (limit ${MAX_CLASSES_PER_TYPE}). ` +
          `One of its seeds reaches a hub class; narrow the seeds or the depth.`
      );
    }

    tables.set(type, classes);
  }

  console.log("\nVerifying fixtures …");
  const failures: string[] = [];
  for (const [classId, expected, label] of FIXTURES) {
    const actual = resolveType(classId, tables);
    const ok = actual === expected;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${classId} ${label}: ${actual ?? "none"} (want ${expected})`
    );
    if (!ok) failures.push(`${classId} ${label}: got ${actual ?? "none"}`);
  }

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} fixture(s) failed; not writing ${OUT_FILE}.`
    );
    console.error("Adjust the seeds or depths above, then re-run.");
    process.exitCode = 1;
    return;
  }

  const counts: Record<string, number> = {};
  const types: Record<string, string> = {};
  for (const [type, ids] of tables) {
    counts[type] = ids.size;
    types[type] = encodeIds(ids);
  }

  const document = {
    $schema: "delta36",
    version: 2,
    generated: new Date().toISOString().slice(0, 10),
    counts,
    types
  };

  writeFileSync(OUT_FILE, JSON.stringify(document), "utf8");
  console.log(`\nWrote ${OUT_FILE}`);
  console.table(counts);
}

await main();
