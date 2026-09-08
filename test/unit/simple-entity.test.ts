import { describe, expect, it } from "vitest";
import {
  convertToSimpleEntity,
  getEntityCountryCode,
  getEntityData,
  getEntityInstanceType,
  getEntityTypeByExtract,
  getEntityTypeByOntology,
  SimpleEntityType
} from "../../src/simple-entity";
import type { WikiEntity } from "../../src/types";

const itemClaim = (id: string, values: string[]) => ({
  id,
  values: values.map((value) => ({ datatype: "wikibase-item", value }))
});

describe("getEntityCountryCode", () => {
  it("maps P17 country claims to lowercase ISO codes", () => {
    const entity: WikiEntity = {
      id: "Q21197",
      claims: { P17: itemClaim("P17", ["Q217"]) }
    };
    expect(getEntityCountryCode(entity)).toEqual(["md"]);
  });

  it("falls back to citizenship, origin and sport country in order", () => {
    expect(
      getEntityCountryCode({
        id: "Q1",
        claims: { P27: itemClaim("P27", ["Q145"]) }
      })
    ).toEqual(["gb"]);
    expect(
      getEntityCountryCode({
        id: "Q1",
        claims: { P1532: itemClaim("P1532", ["Q142"]) }
      })
    ).toEqual(["fr"]);
  });

  it("prefers P17 over the fallbacks", () => {
    expect(
      getEntityCountryCode({
        id: "Q1",
        claims: {
          P17: itemClaim("P17", ["Q183"]),
          P27: itemClaim("P27", ["Q145"])
        }
      })
    ).toEqual(["de"]);
  });

  it("de-duplicates and returns every country of a multi-valued claim", () => {
    expect(
      getEntityCountryCode({
        id: "Q1",
        claims: { P27: itemClaim("P27", ["Q145", "Q30", "Q145"]) }
      })
    ).toEqual(["gb", "us"]);
  });

  it("returns null when nothing resolves", () => {
    expect(getEntityCountryCode({ id: "Q1" })).toBeNull();
    expect(getEntityCountryCode(null)).toBeNull();
    expect(
      getEntityCountryCode({
        id: "Q1",
        claims: { P17: itemClaim("P17", ["Q99999999"]) }
      })
    ).toBeNull();
  });
});

describe("getEntityData", () => {
  it("prefers the rendered form of structured values", () => {
    const data = getEntityData({
      id: "Q937",
      claims: {
        P569: {
          id: "P569",
          values: [
            {
              datatype: "time",
              value: { time: "+1879-03-14T00:00:00Z", precision: 11 },
              value_string: "1879-03-14"
            }
          ]
        },
        P31: itemClaim("P31", ["Q5"])
      }
    });

    expect(data).toEqual({ P569: ["1879-03-14"], P31: ["Q5"] });
  });

  it("skips structured values with no rendering instead of throwing", () => {
    const data = getEntityData({
      id: "Q1",
      claims: {
        P1: {
          id: "P1",
          values: [
            {
              datatype: "globe-coordinate",
              value: { latitude: 1, longitude: 2 }
            }
          ]
        },
        P2: itemClaim("P2", ["Q5"])
      }
    });
    expect(data).toEqual({ P2: ["Q5"] });
  });

  it("returns null without claims", () => {
    expect(getEntityData({ id: "Q1" })).toBeNull();
  });
});

describe("getEntityTypeByOntology", () => {
  it("maps DBpedia and schema.org types", () => {
    expect(getEntityTypeByOntology({ id: "Q1", types: ["schema:City"] })).toBe(
      SimpleEntityType.PLACE
    );
    expect(getEntityTypeByOntology({ id: "Q1", types: ["foaf:Person"] })).toBe(
      SimpleEntityType.PERSON
    );
  });

  it("prefers the organisation when DBpedia says both org and person", () => {
    expect(
      getEntityTypeByOntology({
        id: "Q380",
        types: ["schema:Person", "dbo:Company"]
      })
    ).toBe(SimpleEntityType.ORG);
  });

  it("returns undefined for unknown or absent types", () => {
    expect(getEntityTypeByOntology({ id: "Q1" })).toBeUndefined();
    expect(
      getEntityTypeByOntology({ id: "Q1", types: ["owl:Thing"] })
    ).toBeUndefined();
  });
});

describe("getEntityInstanceType", () => {
  it("derives the type from P31 against the generated class tables", () => {
    expect(
      getEntityInstanceType({
        id: "Q1",
        claims: { P31: itemClaim("P31", ["Q5"]) }
      })
    ).toBe(SimpleEntityType.PERSON);
    expect(
      getEntityInstanceType({
        id: "Q1",
        claims: { P31: itemClaim("P31", ["Q43229"]) }
      })
    ).toBe(SimpleEntityType.ORG);
  });

  it("returns undefined without P31", () => {
    expect(getEntityInstanceType({ id: "Q1" })).toBeUndefined();
    expect(
      getEntityInstanceType({
        id: "Q1",
        claims: { P17: itemClaim("P17", ["Q5"]) }
      })
    ).toBeUndefined();
  });
});

describe("getEntityTypeByExtract", () => {
  it("recognises Romanian patterns", () => {
    expect(
      getEntityTypeByExtract("Cahul este un oraș din Moldova.", "ro")
    ).toBe(SimpleEntityType.PLACE);
    expect(
      getEntityTypeByExtract("Ion Creangă este un scriitor român.", "ro")
    ).toBe(SimpleEntityType.PERSON);
  });

  it("recognises English patterns", () => {
    expect(getEntityTypeByExtract("Paris is a city in France.", "en")).toBe(
      SimpleEntityType.PLACE
    );
  });

  it("returns undefined for unknown languages or empty extracts", () => {
    expect(getEntityTypeByExtract("Ceva.", "xx")).toBeUndefined();
    expect(getEntityTypeByExtract(undefined, "ro")).toBeUndefined();
  });
});

describe("convertToSimpleEntity", () => {
  const entity: WikiEntity = {
    id: "Q937",
    label: "Albert Einstein",
    description: "theoretical physicist",
    pageid: 736,
    extract: "Albert Einstein was a physicist.",
    sitelinks: { en: "Albert Einstein", ro: "Albert Einstein" },
    types: ["schema:Person", "owl:Thing", "dbo:Agent", "schema:Person"],
    categories: ["Category:Physicists", "Category:Physicists"],
    claims: {
      P31: itemClaim("P31", ["Q5"]),
      P27: itemClaim("P27", ["Q39"])
    }
  };

  it("maps every field onto the flat shape", () => {
    const simple = convertToSimpleEntity(entity, "en");

    expect(simple).toMatchObject({
      lang: "en",
      wikiDataId: "Q937",
      name: "Albert Einstein",
      description: "theoretical physicist",
      wikiPageId: 736,
      wikiPageTitle: "Albert Einstein",
      about: "Albert Einstein was a physicist.",
      type: SimpleEntityType.PERSON,
      countryCodes: ["ch"]
    });
  });

  it("drops generic ontology types and de-duplicates the rest", () => {
    expect(convertToSimpleEntity(entity, "en").types).toEqual([
      "schema:Person"
    ]);
  });

  it("de-duplicates categories", () => {
    expect(convertToSimpleEntity(entity, "en").categories).toEqual([
      "Category:Physicists"
    ]);
  });

  it("uses the sitelink of the requested language", () => {
    const simple = convertToSimpleEntity(
      {
        ...entity,
        sitelinks: { en: "Albert Einstein", ro: "Albert Einstein" }
      },
      "ro"
    );
    expect(simple.wikiPageTitle).toBe("Albert Einstein");
    expect(simple.lang).toBe("ro");
  });

  it("falls back to P31 when no ontology types are present", () => {
    const simple = convertToSimpleEntity(
      { id: "Q1", claims: { P31: itemClaim("P31", ["Q5"]) } },
      "en"
    );
    expect(simple.type).toBe(SimpleEntityType.PERSON);
  });

  it("falls back to the extract only when there are no ontology types", () => {
    const fromExtract = convertToSimpleEntity(
      { id: "Q1", extract: "Cahul este un oraș din Moldova." },
      "ro"
    );
    expect(fromExtract.type).toBe(SimpleEntityType.PLACE);

    const withTypes = convertToSimpleEntity(
      {
        id: "Q1",
        extract: "Cahul este un oraș din Moldova.",
        types: ["dbo:Unmapped"]
      },
      "ro"
    );
    expect(withTypes.type).toBeUndefined();
  });

  it("uses the default type as a last resort", () => {
    const simple = convertToSimpleEntity({ id: "Q1" }, "en", {
      defaultType: SimpleEntityType.WORK
    });
    expect(simple.type).toBe(SimpleEntityType.WORK);
  });

  it("omits empty optional fields", () => {
    const simple = convertToSimpleEntity({ id: "Q1" }, "en");
    expect(simple).toEqual({ lang: "en", wikiDataId: "Q1" });
  });
});
