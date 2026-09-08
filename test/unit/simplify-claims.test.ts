import { describe, expect, it } from "vitest";
import {
  simplifyClaim,
  simplifyClaims,
  simplifyPropertyClaims,
  stringifyCoordinates,
  stringifyTime
} from "../../src/wikidata/simplify-claims";
import type { RawClaim } from "../../src/wikidata/raw-types";

const claim = (
  datatype: string,
  type: string,
  value: unknown,
  extra: Partial<RawClaim> = {}
): RawClaim => ({
  mainsnak: { snaktype: "value", datatype, datavalue: { type, value } },
  rank: "normal",
  ...extra
});

describe("simplifyClaim", () => {
  it("simplifies string-like datatypes", () => {
    expect(simplifyClaim(claim("string", "string", "abc"))?.value).toBe("abc");
    expect(
      simplifyClaim(claim("external-id", "string", "nm0000123"))?.value
    ).toBe("nm0000123");
    expect(simplifyClaim(claim("url", "string", "https://x.dev"))?.value).toBe(
      "https://x.dev"
    );
  });

  it("simplifies an item reference to its id", () => {
    const result = simplifyClaim(
      claim("wikibase-item", "wikibase-entityid", {
        "entity-type": "item",
        "numeric-id": 5,
        id: "Q5"
      })
    );
    expect(result?.value).toBe("Q5");
  });

  it("simplifies a property reference to its id, not to an object", () => {
    const result = simplifyClaim(
      claim("wikibase-property", "wikibase-entityid", {
        "entity-type": "property",
        "numeric-id": 31,
        id: "P31"
      })
    );
    expect(result?.value).toBe("P31");
  });

  it("reconstructs an entity id from a legacy numeric-id only value", () => {
    const result = simplifyClaim(
      claim("wikibase-item", "wikibase-entityid", {
        "entity-type": "item",
        "numeric-id": 42
      })
    );
    expect(result?.value).toBe("Q42");
  });

  it("simplifies monolingual text to its text", () => {
    const result = simplifyClaim(
      claim("monolingualtext", "monolingualtext", {
        text: "Chișinău",
        language: "ro"
      })
    );
    expect(result?.value).toBe("Chișinău");
  });

  it("renders a quantity without its bounds", () => {
    const result = simplifyClaim(
      claim("quantity", "quantity", {
        amount: "+635000",
        unit: "1",
        upperBound: "+635001",
        lowerBound: "+634999"
      })
    );
    expect(result?.value_string).toBe("635000");
  });

  it("keeps unknown datavalue shapes out of the result", () => {
    expect(simplifyClaim(claim("weird", "weird", { a: 1 }))).toBeNull();
  });

  it("returns null for novalue/somevalue snaks", () => {
    expect(
      simplifyClaim({ mainsnak: { snaktype: "novalue" }, rank: "normal" })
    ).toBeNull();
    expect(
      simplifyClaim({ mainsnak: { snaktype: "somevalue" }, rank: "normal" })
    ).toBeNull();
    expect(simplifyClaim({ mainsnak: null })).toBeNull();
    expect(simplifyClaim(undefined)).toBeNull();
  });

  it("records the statement rank", () => {
    const result = simplifyClaim(
      claim("string", "string", "x", { rank: "preferred" })
    );
    expect(result?.rank).toBe("preferred");
  });

  it("simplifies qualifiers recursively", () => {
    const result = simplifyClaim(
      claim(
        "wikibase-item",
        "wikibase-entityid",
        { id: "Q30" },
        {
          qualifiers: {
            P580: [
              {
                snaktype: "value",
                datatype: "time",
                datavalue: {
                  type: "time",
                  value: { time: "+2009-01-20T00:00:00Z", precision: 11 }
                }
              }
            ]
          }
        }
      )
    );
    expect(result?.qualifiers?.["P580"]?.values[0]?.value_string).toBe(
      "2009-01-20"
    );
  });
});

describe("stringifyTime", () => {
  it("renders a day-precision date", () => {
    expect(
      stringifyTime({ time: "+1504-07-02T00:00:00Z", precision: 11 })
    ).toBe("1504-07-02");
  });

  it("renders a month-precision date", () => {
    expect(
      stringifyTime({ time: "+1879-03-14T00:00:00Z", precision: 10 })
    ).toBe("1879-03");
  });

  it("renders a year-precision date", () => {
    expect(stringifyTime({ time: "+1879-03-14T00:00:00Z", precision: 9 })).toBe(
      "1879"
    );
  });

  it("keeps the sign of BCE dates", () => {
    expect(
      stringifyTime({ time: "-0044-03-15T00:00:00Z", precision: 11 })
    ).toBe("-0044-03-15");
    expect(
      stringifyTime({ time: "-0100-07-12T00:00:00Z", precision: 10 })
    ).toBe("-0100-07");
    expect(stringifyTime({ time: "-0500-00-00T00:00:00Z", precision: 9 })).toBe(
      "-0500"
    );
  });

  it("keeps hour-or-finer precision as the full timestamp", () => {
    expect(
      stringifyTime({ time: "+2020-01-02T03:04:05Z", precision: 14 })
    ).toBe("2020-01-02T03:04:05Z");
  });

  it("leaves precisions coarser than a year untouched", () => {
    expect(stringifyTime({ time: "+1900-00-00T00:00:00Z", precision: 8 })).toBe(
      "+1900-00-00T00:00:00Z"
    );
  });
});

describe("stringifyCoordinates", () => {
  it("trims trailing decimals without eating integer digits", () => {
    expect(stringifyCoordinates({ latitude: 10, longitude: 20 })).toBe("10,20");
    expect(stringifyCoordinates({ latitude: 100, longitude: -50 })).toBe(
      "100,-50"
    );
  });

  it("keeps up to four decimals", () => {
    expect(
      stringifyCoordinates({ latitude: 47.0105, longitude: 28.8638 })
    ).toBe("47.0105,28.8638");
  });

  it("trims only the trailing zeros of the fraction", () => {
    expect(stringifyCoordinates({ latitude: 10.1, longitude: 0 })).toBe(
      "10.1,0"
    );
    expect(stringifyCoordinates({ latitude: 10.5, longitude: 20.25 })).toBe(
      "10.5,20.25"
    );
  });
});

describe("simplifyPropertyClaims", () => {
  it("drops deprecated statements by default", () => {
    const prop = simplifyPropertyClaims(
      [
        claim("string", "string", "bad", { rank: "deprecated" }),
        claim("string", "string", "good")
      ],
      "P1"
    );
    expect(prop.values.map((v) => v.value)).toEqual(["good"]);
  });

  it("keeps deprecated statements when asked", () => {
    const prop = simplifyPropertyClaims(
      [claim("string", "string", "bad", { rank: "deprecated" })],
      "P1",
      { keepDeprecated: true }
    );
    expect(prop.values).toHaveLength(1);
  });

  it("puts preferred statements first, keeping the rest stable", () => {
    const prop = simplifyPropertyClaims(
      [
        claim("string", "string", "normal-1"),
        claim("string", "string", "preferred", { rank: "preferred" }),
        claim("string", "string", "normal-2")
      ],
      "P1"
    );
    expect(prop.values.map((v) => v.value)).toEqual([
      "preferred",
      "normal-1",
      "normal-2"
    ]);
  });
});

describe("simplifyClaims", () => {
  it("omits properties whose statements all carry no value", () => {
    const claims = simplifyClaims({
      P1: [{ mainsnak: { snaktype: "novalue" } }],
      P2: [claim("string", "string", "kept")]
    });
    expect(Object.keys(claims)).toEqual(["P2"]);
  });

  it("tolerates a missing or malformed claims object", () => {
    expect(simplifyClaims(undefined)).toEqual({});
    expect(simplifyClaims(null)).toEqual({});
    expect(simplifyClaims({ P1: "nope" as unknown as RawClaim[] })).toEqual({});
  });
});
