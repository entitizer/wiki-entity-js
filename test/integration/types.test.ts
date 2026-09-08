import { beforeAll, describe, expect, it } from "vitest";
import {
  getEntities,
  getEntityTypesByNames,
  setUserAgent
} from "../../src/index";

beforeAll(() => {
  setUserAgent(
    process.env["WIKI_ENTITY_USER_AGENT"] ??
      "wiki-entity-tests/1.0 (https://github.com/entitizer/wiki-entity-js)"
  );
});

describe("DBpedia types", () => {
  it("types a city as a place, never as a person", async () => {
    const [entity] = await getEntities({
      language: "en",
      titles: ["Chișinău"],
      types: true
    });

    expect(entity?.id).toBe("Q21197");
    expect(entity?.types).toBeDefined();
    expect(entity?.types).toEqual(
      expect.arrayContaining([expect.stringMatching(/:City$/)])
    );
    // DBpedia mis-maps some settlements as people; we repair that.
    expect(entity?.types).not.toContain("dbo:Person");
  });

  it("types a politician as a person", async () => {
    const [entity] = await getEntities({
      language: "en",
      titles: ["Barack Obama"],
      types: true
    });
    expect(entity?.types).toEqual(
      expect.arrayContaining([expect.stringMatching(/:Person$/)])
    );
  });

  it("recognises a fictional character", async () => {
    const [entity] = await getEntities({
      language: "ro",
      titles: ["Mickey Mouse"],
      types: true
    });
    expect(entity?.types).toContain("dbo:FictionalCharacter");
  });

  it("recognises a book from a non-English title", async () => {
    const [entity] = await getEntities({
      language: "ro",
      titles: ["Alice în Țara Minunilor"],
      types: true
    });
    expect(entity?.types).toContain("dbo:Book");
  });

  it("recognises a newspaper", async () => {
    const [entity] = await getEntities({
      language: "ro",
      titles: ["The New York Times"],
      types: true
    });
    expect(entity?.types).toContain("dbo:Newspaper");
  });

  it.each([
    ["ru", "Соединённые Штаты Америки"],
    ["en", "Italy"],
    ["en", "Moscow"]
  ])("does not type the place %s:%s as a person", async (lang, title) => {
    const [entity] = await getEntities({
      language: lang,
      titles: [title],
      types: true
    });
    expect(entity?.types).toBeDefined();
    expect(entity?.types).not.toContain("dbo:Person");
  });

  it("honours the prefix filter", async () => {
    const [entity] = await getEntities({
      language: "en",
      titles: ["Italy"],
      types: ["schema"]
    });

    expect(entity?.types?.length).toBeGreaterThan(0);
    for (const type of entity?.types ?? []) {
      expect(type.startsWith("schema:")).toBe(true);
    }
  });

  it("types many entities in one request", async () => {
    const types = await getEntityTypesByNames(["Italy", "France", "Bono"]);

    expect(types.get("Italy")).toEqual(
      expect.arrayContaining([expect.stringMatching(/:Country$/)])
    );
    expect(types.get("France")).toBeDefined();
    expect(types.get("Bono")).toEqual(
      expect.arrayContaining([expect.stringMatching(/:Person$/)])
    );
  });

  it("does not fail the whole call when an entity is unknown to DBpedia", async () => {
    const results = await getEntities({
      language: "en",
      titles: ["Cabernet Sauvignon"],
      types: true
    });
    expect(results[0]?.id).toBeDefined();
  });
});
