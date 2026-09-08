import { beforeAll, describe, expect, it } from "vitest";
import { getEntities, mapRedirects, setUserAgent } from "../../src/index";

beforeAll(() => {
  setUserAgent(
    process.env["WIKI_ENTITY_USER_AGENT"] ??
      "wiki-entity-tests/1.0 (https://github.com/entitizer/wiki-entity)"
  );
});

describe("getEntities by title", () => {
  it("returns results in the order the titles were given", async () => {
    const results = await getEntities({
      languages: ["en", "ru", "de", "fr", "it"],
      titles: ["Chișinău", "Cantemir, Moldova"]
    });

    expect(results[0]?.id).toBe("Q21197");
    expect(results[1]?.id).toBe("Q2250055");
  });

  it("honours the `languages` param instead of returning every label", async () => {
    const [entity] = await getEntities({
      ids: ["Q21197"],
      languages: ["en", "ru", "de"]
    });

    const langs = Object.keys(entity?.labels ?? {}).sort();
    // `mul` is always requested as a fallback, but nothing else may leak in.
    expect(langs.filter((l) => l !== "mul")).toEqual(["de", "en", "ru"]);
    expect(entity?.label).toBe("Chișinău");
  });

  it("resolves the label of an item that only has a `mul` name", async () => {
    // Wikidata moved names that are identical across languages to `mul`.
    const [entity] = await getEntities({
      ids: ["Q937"],
      languages: ["en"]
    });
    expect(entity?.label).toBe("Albert Einstein");
  });

  it("resolves a title containing quotes and underscores", async () => {
    const results = await getEntities({
      language: "en",
      titles: ['Joseph_"Chip"_Yablonski']
    });
    expect(results[0]?.id).toBe("Q6280729");
  });

  it("omits entities that do not exist", async () => {
    const results = await getEntities({
      language: "en",
      ids: ["Q7759840"],
      types: false,
      categories: false
    });
    expect(results).toEqual([]);
  });

  it("returns results in the order the ids were given", async () => {
    const results = await getEntities({
      ids: ["Q2438184", "Q21197"],
      props: ["labels", "descriptions"]
    });
    expect(results.map((r) => r.id)).toEqual(["Q2438184", "Q21197"]);
  });
});

describe("claims", () => {
  it("renders a date claim at day precision", async () => {
    const [entity] = await getEntities({ ids: ["Q218134"] });
    expect(entity?.claims?.["P570"]?.values[0]?.value_string).toBe(
      "1504-07-02"
    );
  });

  it("keeps the sign of a BCE date", async () => {
    // Julius Caesar, died 15 March 44 BC.
    const [entity] = await getEntities({ ids: ["Q1048"] });
    expect(entity?.claims?.["P570"]?.values[0]?.value_string).toMatch(/^-0*44/);
  });

  it("renders coordinates without dropping integer digits", async () => {
    // Chișinău sits at roughly 47.02, 28.84.
    const [entity] = await getEntities({ ids: ["Q21197"] });
    const coords = entity?.claims?.["P625"]?.values[0]?.value_string;
    expect(coords).toMatch(/^4[67](\.\d+)?,2[89](\.\d+)?$/);
  });

  it("labels properties and item values with claims: 'all'", async () => {
    const [entity] = await getEntities({
      ids: ["Q937"],
      language: "en",
      claims: "all"
    });

    expect(entity?.claims?.["P31"]?.label).toBe("instance of");
    expect(entity?.claims?.["P31"]?.values[0]?.value).toBe("Q5");
    expect(entity?.claims?.["P31"]?.values[0]?.label).toBe("human");
  });
});

describe("extracts", () => {
  it("returns an extract for a single entity", async () => {
    const [entity] = await getEntities({
      language: "en",
      titles: ["Chișinău"],
      extract: 3
    });

    expect(entity?.id).toBe("Q21197");
    expect(entity?.extract).toBeTruthy();
  });

  it("returns an extract for every entity, not only the first", async () => {
    const results = await getEntities({
      language: "en",
      titles: ["Chișinău", "Italy", "France"],
      extract: 2
    });

    expect(results).toHaveLength(3);
    for (const entity of results) {
      expect(entity.extract, `no extract for ${entity.id}`).toBeTruthy();
    }
  });
});

describe("redirects", () => {
  it("lists the articles redirecting to a page", async () => {
    const [entity] = await getEntities({
      language: "en",
      titles: ["Chișinău"],
      props: ["info", "labels", "descriptions", "sitelinks"],
      redirects: true
    });

    expect(entity?.id).toBe("Q21197");
    expect(entity?.redirects?.length).toBeGreaterThan(0);
  });

  it("reports the target of a Wikidata entity redirect", async () => {
    const [entity] = await getEntities({
      language: "en",
      ids: ["Q104772811"],
      props: ["info", "labels", "descriptions", "sitelinks"]
    });
    expect(entity?.redirectsToId).toBe("Q104794561");
  });

  it("returns the Wikipedia page id, not the Wikidata one", async () => {
    const [entity] = await getEntities({
      language: "en",
      titles: ["Kara Tointon"]
    });
    expect(entity?.pageid).toBe(3198752);
  });

  it("follows a Wikipedia redirect back to the entity", async () => {
    const [entity] = await getEntities({
      language: "ro",
      titles: ["Brashov"],
      redirects: true
    });
    expect(entity?.id).toBe("Q82174");
  });

  it("maps redirect titles to their targets", async () => {
    const result = await mapRedirects(["Brashov"], "ro");
    expect(result).toEqual({ Brashov: "Brașov" });
  });
});

describe("categories", () => {
  it("returns non-hidden article categories", async () => {
    const [entity] = await getEntities({
      language: "en",
      titles: ["Chișinău"],
      categories: true
    });

    expect(entity?.categories?.length).toBeGreaterThan(0);
    expect(entity?.categories?.[0]).toMatch(/^Category:/);
  });
});

describe("wikiPageId: false", () => {
  it("leaves pageid unset rather than exposing the Wikidata page id", async () => {
    const [entity] = await getEntities({
      language: "en",
      ids: ["Q21197"],
      wikiPageId: false
    });
    expect(entity?.pageid).toBeUndefined();
  });
});
