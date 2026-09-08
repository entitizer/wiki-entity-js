import { beforeAll, describe, expect, it } from "vitest";
import {
  convertToSimpleEntity,
  getEntities,
  setUserAgent,
  SimpleEntityType
} from "../../src/index";
import { getEntityCountryCode } from "../../src/simple-entity/get-entity-country";

beforeAll(() => {
  setUserAgent(
    process.env["WIKI_ENTITY_USER_AGENT"] ??
      "wiki-entity-tests/1.0 (https://github.com/entitizer/wiki-entity-js)"
  );
});

describe("getEntityCountryCode", () => {
  it("resolves the country of a Moldovan entity", async () => {
    const entities = await getEntities({
      language: "ro",
      ids: ["Q12729770"],
      claims: "item"
    });

    expect(entities).toHaveLength(1);
    expect(getEntityCountryCode(entities[0])).toEqual(["md"]);
  });
});

describe("convertToSimpleEntity", () => {
  it("converts a person", async () => {
    const entities = await getEntities({
      language: "en",
      ids: ["Q18548924"],
      claims: "none",
      types: true
    });

    const entity = convertToSimpleEntity(entities[0]!, "en");
    expect(entity.name).toBe("Adrian Ursu");
    expect(entity.wikiDataId).toBe("Q18548924");
    expect(entity.type).toBe(SimpleEntityType.PERSON);
  });

  it("uses the sitelink of the requested language", async () => {
    const entities = await getEntities({
      language: "ro",
      ids: ["Q18548924"],
      claims: "none",
      types: true
    });

    const entity = convertToSimpleEntity(entities[0]!, "ro");
    expect(entity.name).toBe("Adrian Ursu");
    expect(entity.wikiPageTitle).toBe("Adrian Ursu (cântăreț)");
    expect(entity.type).toBe(SimpleEntityType.PERSON);
  });

  it("exposes birth dates and country codes", async () => {
    const entities = await getEntities({
      language: "en",
      ids: ["Q937"],
      claims: "all",
      types: true
    });

    const entity = convertToSimpleEntity(entities[0]!, "en");
    expect(entity.name).toBe("Albert Einstein");
    expect(entity.type).toBe(SimpleEntityType.PERSON);
    expect(entity.data?.["P31"]).toContain("Q5");
    expect(entity.data?.["P569"]?.[0]).toBe("1879-03-14");
    expect(entity.countryCodes).toContain("ch");
  });

  it("handles an entity whose dates are unknown", async () => {
    const entities = await getEntities({
      language: "ro",
      titles: ["Ștefan cel Mare"],
      claims: "item",
      types: true
    });

    const entity = convertToSimpleEntity(entities[0]!, "ro");
    expect(entity.name).toBe("Ștefan cel Mare");
    expect(entity.type).toBe(SimpleEntityType.PERSON);
    expect(entity.data?.["P31"]).toContain("Q5");
  });

  it("converts a place", async () => {
    const entities = await getEntities({
      language: "en",
      ids: ["Q21197"],
      claims: "all",
      types: true
    });

    const entity = convertToSimpleEntity(entities[0]!, "en");
    expect(entity.name).toBe("Chișinău");
    expect(entity.type).toBe(SimpleEntityType.PLACE);
    expect(entity.countryCodes).toEqual(["md"]);
  });

  it("converts an organisation", async () => {
    const entities = await getEntities({
      language: "en",
      ids: ["Q380"],
      claims: "none",
      types: true
    });

    const entity = convertToSimpleEntity(entities[0]!, "en");
    expect(entity.wikiDataId).toBe("Q380");
    expect(entity.type).toBe(SimpleEntityType.ORG);
  });

  it("converts an event", async () => {
    const entities = await getEntities({
      language: "en",
      ids: ["Q189571"],
      claims: "none",
      types: true
    });

    const entity = convertToSimpleEntity(entities[0]!, "en");
    expect(entity.name).toBe("UEFA Euro 2016");
    expect(entity.type).toBe(SimpleEntityType.EVENT);
  });

  it("converts a creative work", async () => {
    const entities = await getEntities({
      language: "ro",
      titles: ["Alice în Țara Minunilor"],
      claims: "none",
      types: true
    });

    const entity = convertToSimpleEntity(entities[0]!, "ro");
    expect(entity.wikiDataId).toBeDefined();
    expect(entity.type).toBe(SimpleEntityType.WORK);
  });

  it.each([
    ["Q61504", "iPhone 5"],
    ["Q11215", "Windows 7"]
  ])("converts the product %s", async (id, name) => {
    const entities = await getEntities({
      language: "en",
      ids: [id],
      claims: "all",
      types: true
    });

    const entity = convertToSimpleEntity(entities[0]!, "en");
    expect(entity.name).toBe(name);
    expect(entity.type).toBe(SimpleEntityType.PRODUCT);
  });
});
