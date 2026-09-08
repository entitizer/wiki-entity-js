import { describe, expect, it } from "vitest";
import {
  simplifyAliases,
  simplifyEntity,
  simplifySitelinks
} from "../../src/wikidata/simplify-entity";

const raw = {
  id: "Q21197",
  pageid: 24531,
  labels: {
    en: { language: "en", value: "Chișinău" },
    ro: { language: "ro", value: "Chișinău" }
  },
  descriptions: {
    en: { language: "en", value: "capital of Moldova" }
  },
  aliases: {
    en: [
      { language: "en", value: "Kishinev" },
      { language: "en", value: "Kishinyov" }
    ]
  },
  sitelinks: {
    enwiki: { title: "Chișinău" },
    rowiki: { title: "Chișinău" },
    commonswiki: { title: "Category:Chișinău" }
  },
  claims: {
    P31: [
      {
        mainsnak: {
          snaktype: "value",
          datatype: "wikibase-item",
          datavalue: { type: "wikibase-entityid", value: { id: "Q5119" } }
        },
        rank: "normal"
      }
    ]
  }
};

describe("simplifyEntity", () => {
  it("flattens labels, descriptions, aliases, sitelinks and claims", () => {
    const entity = simplifyEntity("en", raw);

    expect(entity.id).toBe("Q21197");
    expect(entity.pageid).toBe(24531);
    expect(entity.label).toBe("Chișinău");
    expect(entity.labels).toEqual({ en: "Chișinău", ro: "Chișinău" });
    expect(entity.description).toBe("capital of Moldova");
    expect(entity.descriptions).toEqual({ en: "capital of Moldova" });
    expect(entity.aliases).toEqual(["Kishinev", "Kishinyov"]);
    expect(entity.sitelinks).toEqual({
      en: "Chișinău",
      ro: "Chișinău",
      commons: "Category:Chișinău"
    });
    expect(entity.claims?.["P31"]?.values[0]?.value).toBe("Q5119");
  });

  it("resolves label and description in the requested language", () => {
    const entity = simplifyEntity("ro", raw);
    expect(entity.label).toBe("Chișinău");
    // No Romanian description exists, so the scalar field stays unset.
    expect(entity.description).toBeUndefined();
    expect(entity.aliases).toBeUndefined();
  });

  it("keeps the datatype of a property entity", () => {
    const entity = simplifyEntity("en", {
      id: "P31",
      datatype: "wikibase-item",
      labels: { en: { value: "instance of" } }
    });
    expect(entity.datatype).toBe("wikibase-item");
    expect(entity.label).toBe("instance of");
  });

  it("carries redirect ids through", () => {
    const entity = simplifyEntity("en", {
      id: "Q104794561",
      redirectsToId: "Q104794561",
      redirectsFromId: "Q104772811"
    });
    expect(entity.redirectsToId).toBe("Q104794561");
    expect(entity.redirectsFromId).toBe("Q104772811");
  });

  it("honours the opt-out options", () => {
    const entity = simplifyEntity("en", raw, {
      labels: false,
      descriptions: false,
      aliases: false,
      sitelinks: false,
      claims: false
    });
    expect(entity).toEqual({ id: "Q21197", pageid: 24531 });
  });

  it("tolerates an entity with no props at all", () => {
    expect(simplifyEntity("en", { id: "Q1" })).toEqual({ id: "Q1" });
  });
});

describe("mul (multilingual) labels", () => {
  // Since 2024 Wikidata keeps the name of many items only under `mul`,
  // deleting the identical per-language labels.
  const mulOnly = {
    id: "Q937",
    labels: { mul: { language: "mul", value: "Albert Einstein" } },
    aliases: { mul: [{ value: "Einstein" }] },
    descriptions: { en: { language: "en", value: "physicist" } }
  };

  it("falls back to the mul label when the language has none", () => {
    const entity = simplifyEntity("en", mulOnly);
    expect(entity.label).toBe("Albert Einstein");
    expect(entity.description).toBe("physicist");
  });

  it("uses the mul label for any language", () => {
    expect(simplifyEntity("ro", mulOnly).label).toBe("Albert Einstein");
  });

  it("prefers a real per-language label over mul", () => {
    const entity = simplifyEntity("en", {
      id: "Q1",
      labels: {
        en: { language: "en", value: "English name" },
        mul: { language: "mul", value: "Multilingual name" }
      }
    });
    expect(entity.label).toBe("English name");
  });

  it("merges language aliases with mul aliases", () => {
    const entity = simplifyEntity("en", {
      id: "Q1",
      aliases: {
        en: [{ value: "A" }, { value: "B" }],
        mul: [{ value: "B" }, { value: "C" }]
      }
    });
    expect(entity.aliases).toEqual(["A", "B", "C"]);
  });

  it("does not invent a description from mul", () => {
    const entity = simplifyEntity("ro", mulOnly);
    expect(entity.description).toBeUndefined();
  });
});

describe("simplifySitelinks", () => {
  it("strips only a trailing `wiki`", () => {
    expect(
      simplifySitelinks({
        enwiki: { title: "A" },
        enwikiquote: { title: "B" },
        zh_yuewiki: { title: "C" }
      })
    ).toEqual({ en: "A", enwikiquote: "B", zh_yue: "C" });
  });

  it("returns an empty object for missing data", () => {
    expect(simplifySitelinks(undefined)).toEqual({});
  });
});

describe("simplifyAliases", () => {
  it("groups alias values by language", () => {
    expect(
      simplifyAliases({ en: [{ value: "a" }, { value: "b" }], de: [] })
    ).toEqual({ en: ["a", "b"], de: [] });
  });
});
