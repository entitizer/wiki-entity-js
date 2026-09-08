import { describe, expect, it } from "vitest";
import { COUNTRIES, decodeIds, getEntityTypeIds } from "../../src/data";
import { SimpleEntityType } from "../../src/simple-entity/simple-entity";

describe("decodeIds", () => {
  it("expands delta encoded base-36 ids", () => {
    // 5, 5+1*36+10=5+46=51, 51+3=54
    expect([...decodeIds("5.1a.3")]).toEqual(["Q5", "Q51", "Q54"]);
  });

  it("returns an empty set for an empty string", () => {
    expect(decodeIds("").size).toBe(0);
  });
});

describe("COUNTRIES", () => {
  it("maps Wikidata ids to ISO codes", () => {
    expect(COUNTRIES["Q145"]).toEqual({ id: "Q145", cc2: "GB", cc3: "GBR" });
    expect(COUNTRIES["Q183"]?.cc2).toBe("DE");
  });

  it("uses uppercase two and three letter codes throughout", () => {
    for (const [id, country] of Object.entries(COUNTRIES)) {
      expect(id).toMatch(/^Q[1-9]\d*$/);
      expect(country.cc2).toMatch(/^[A-Z]{2}$/);
      expect(country.cc3).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("covers the major countries", () => {
    expect(Object.keys(COUNTRIES).length).toBeGreaterThan(150);
    const codes = new Set(Object.values(COUNTRIES).map((c) => c.cc2));
    for (const cc of ["US", "GB", "DE", "FR", "MD", "RO", "CH", "JP", "BR"]) {
      expect(codes).toContain(cc);
    }
  });
});

describe("getEntityTypeIds", () => {
  it("contains the seed classes of each type", () => {
    expect(getEntityTypeIds(SimpleEntityType.PERSON)).toContain("Q5");
    expect(getEntityTypeIds(SimpleEntityType.ORG)).toContain("Q43229");
    expect(getEntityTypeIds(SimpleEntityType.EVENT)).toContain("Q1656682");
  });

  it("returns an empty set for an unknown type", () => {
    expect(getEntityTypeIds("Z").size).toBe(0);
  });

  it("caches the decoded sets", () => {
    expect(getEntityTypeIds(SimpleEntityType.PERSON)).toBe(
      getEntityTypeIds(SimpleEntityType.PERSON)
    );
  });
});
