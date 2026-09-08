import { afterEach, describe, expect, it, vi } from "vitest";
import { exploreEntityClaims, getEntities } from "../../src/wikidata";
import type { WikidataEntityClaims } from "../../src/types";
import { installFetchMock, type RecordedCall } from "./helpers/mock-fetch";

afterEach(() => vi.unstubAllGlobals());

const itemSnak = (id: string) => ({
  mainsnak: {
    snaktype: "value",
    datatype: "wikibase-item",
    datavalue: { type: "wikibase-entityid", value: { id } }
  },
  rank: "normal"
});

const label = (id: string, value: string, extra: object = {}) => ({
  id,
  labels: { en: { language: "en", value } },
  descriptions: { en: { language: "en", value: `${value} description` } },
  ...extra
});

const SUBJECT = {
  Q937: {
    id: "Q937",
    type: "item",
    labels: { en: { language: "en", value: "Albert Einstein" } },
    claims: {
      P31: [itemSnak("Q5")],
      P27: [itemSnak("Q39"), itemSnak("Q30")]
    }
  }
};

/** Serve the subject first, then look up whatever ids are asked for. */
function serveLookups(lookup: Record<string, object>) {
  return installFetchMock((call: RecordedCall, index) => {
    if (index === 0) return { json: { entities: SUBJECT } };
    const ids = call.params.get("ids")?.split("|") ?? [];
    return {
      json: {
        entities: Object.fromEntries(
          ids.filter((id) => id in lookup).map((id) => [id, lookup[id]!])
        )
      }
    };
  });
}

describe("getEntities with claims: 'item'", () => {
  it("labels the item values of every claim", async () => {
    serveLookups({
      Q5: label("Q5", "human"),
      Q39: label("Q39", "Switzerland"),
      Q30: label("Q30", "United States")
    });

    const entities = await getEntities({ ids: ["Q937"], claims: "item" });
    const claims = entities["Q937"]?.claims;

    expect(claims?.["P31"]?.values[0]?.label).toBe("human");
    expect(claims?.["P27"]?.values[0]?.label).toBe("Switzerland");
    expect(claims?.["P27"]?.values[1]?.label).toBe("United States");
    expect(claims?.["P31"]?.values[0]?.description).toBe("human description");
  });

  it("looks every referenced item up in a single extra request", async () => {
    const mock = serveLookups({
      Q5: label("Q5", "human"),
      Q39: label("Q39", "Switzerland"),
      Q30: label("Q30", "United States")
    });

    await getEntities({ ids: ["Q937"], claims: "item" });

    // One request for the subject, one for all three referenced items.
    expect(mock.calls).toHaveLength(2);
    expect(mock.paramsOf(1).get("ids")).toBe("Q5|Q39|Q30");
    expect(mock.paramsOf(1).get("props")).toBe(
      "info|labels|descriptions|datatype"
    );
  });

  it("does not label properties in item mode", async () => {
    serveLookups({ Q5: label("Q5", "human") });
    const entities = await getEntities({ ids: ["Q937"], claims: "item" });
    expect(entities["Q937"]?.claims?.["P31"]?.label).toBeUndefined();
  });
});

describe("getEntities with claims: 'property'", () => {
  it("labels the properties themselves", async () => {
    serveLookups({
      P31: label("P31", "instance of", { datatype: "wikibase-item" }),
      P27: label("P27", "country of citizenship", {
        datatype: "wikibase-item"
      })
    });

    const entities = await getEntities({ ids: ["Q937"], claims: "property" });
    const claims = entities["Q937"]?.claims;

    expect(claims?.["P31"]?.label).toBe("instance of");
    expect(claims?.["P27"]?.label).toBe("country of citizenship");
    expect(claims?.["P31"]?.description).toBe("instance of description");
    expect(claims?.["P31"]?.["datatype"]).toBe("wikibase-item");
  });

  it("requests the property ids, which are not item ids", async () => {
    const mock = serveLookups({});
    await getEntities({ ids: ["Q937"], claims: "property" });
    expect(mock.paramsOf(1).get("ids")).toBe("P31|P27");
  });
});

describe("getEntities with claims: 'all'", () => {
  it("labels both the properties and their item values", async () => {
    serveLookups({
      P31: label("P31", "instance of"),
      P27: label("P27", "country of citizenship"),
      Q5: label("Q5", "human"),
      Q39: label("Q39", "Switzerland"),
      Q30: label("Q30", "United States")
    });

    const entities = await getEntities({ ids: ["Q937"], claims: "all" });
    const claims = entities["Q937"]?.claims;

    expect(claims?.["P31"]?.label).toBe("instance of");
    expect(claims?.["P31"]?.values[0]?.label).toBe("human");
  });
});

describe("getEntities with claims: 'none'", () => {
  it("makes no follow-up requests", async () => {
    const mock = serveLookups({});
    const entities = await getEntities({ ids: ["Q937"] });

    expect(mock.calls).toHaveLength(1);
    expect(entities["Q937"]?.claims?.["P31"]?.values[0]?.value).toBe("Q5");
    expect(entities["Q937"]?.claims?.["P31"]?.values[0]?.label).toBeUndefined();
  });
});

describe("exploreEntityClaims", () => {
  it("resolves item values inside qualifiers too", async () => {
    installFetchMock(() => ({
      json: { entities: { Q30: label("Q30", "United States") } }
    }));

    const claims: WikidataEntityClaims = {
      P39: {
        id: "P39",
        values: [
          {
            datatype: "wikibase-item",
            value: "Q11696",
            qualifiers: {
              P17: {
                id: "P17",
                values: [{ datatype: "wikibase-item", value: "Q30" }]
              }
            }
          }
        ]
      }
    };

    await exploreEntityClaims(claims, { language: "en" });
    expect(
      claims["P39"]?.values[0]?.qualifiers?.["P17"]?.values[0]?.label
    ).toBe("United States");
  });

  it("does nothing when there is nothing to resolve", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await exploreEntityClaims(undefined, { language: "en" });
    await exploreEntityClaims({}, { language: "en" });
    expect(mock.calls).toHaveLength(0);
  });
});
