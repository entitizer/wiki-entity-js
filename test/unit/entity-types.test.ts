import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDbpediaEndpoint,
  getEntityTypesByName,
  getEntityTypesByNames,
  setDbpediaEndpoint,
  toResourceIri
} from "../../src/wikidata/entity-types";
import { installFetchMock } from "./helpers/mock-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  setDbpediaEndpoint("https://dbpedia.org/sparql");
});

const binding = (subject: string, type: string) => ({
  s: { value: subject },
  type: { value: type }
});

const RESOURCE = "http://dbpedia.org/resource/";

describe("toResourceIri", () => {
  it("replaces whitespace with underscores", () => {
    expect(toResourceIri("Barack Obama")).toBe(`${RESOURCE}Barack_Obama`);
  });

  it("keeps unicode characters readable", () => {
    expect(toResourceIri("Chișinău")).toBe(`${RESOURCE}Chișinău`);
  });

  it("escapes characters that would terminate the SPARQL IRI", () => {
    expect(toResourceIri('Joseph "Chip" Yablonski')).toBe(
      `${RESOURCE}Joseph_%22Chip%22_Yablonski`
    );
    expect(toResourceIri("100% Pure")).toBe(`${RESOURCE}100%25_Pure`);
    expect(toResourceIri("a<b>c")).toBe(`${RESOURCE}a%3Cb%3Ec`);
  });
});

describe("endpoint configuration", () => {
  it("defaults to HTTPS", () => {
    expect(getDbpediaEndpoint()).toBe("https://dbpedia.org/sparql");
  });

  it("can be pointed at a mirror", async () => {
    setDbpediaEndpoint("https://mirror.test/sparql");
    const mock = installFetchMock(() => ({
      json: { results: { bindings: [] } }
    }));
    await getEntityTypesByName("A");
    expect(mock.calls[0]?.url.origin).toBe("https://mirror.test");
  });

  it("rejects an empty endpoint", () => {
    expect(() => setDbpediaEndpoint("")).toThrow(TypeError);
  });
});

describe("getEntityTypesByNames", () => {
  it("asks for all names in a single VALUES query", async () => {
    const mock = installFetchMock(() => ({
      json: { results: { bindings: [] } }
    }));
    await getEntityTypesByNames(["Italy", "France", "Spain"]);

    expect(mock.calls).toHaveLength(1);
    const query = mock.paramsOf(0).get("query") ?? "";
    expect(query).toContain(`<${RESOURCE}Italy>`);
    expect(query).toContain(`<${RESOURCE}France>`);
    expect(query).toContain(`<${RESOURCE}Spain>`);
    expect(mock.calls[0]?.headers.get("accept")).toBe(
      "application/sparql-results+json"
    );
  });

  it("batches long name lists", async () => {
    const names = Array.from({ length: 60 }, (_, i) => `Name${i}`);
    const mock = installFetchMock(() => ({
      json: { results: { bindings: [] } }
    }));
    await getEntityTypesByNames(names);
    expect(mock.calls).toHaveLength(3);
  });

  it("maps each result back to the name that was asked for", async () => {
    installFetchMock(() => ({
      json: {
        results: {
          bindings: [
            binding(`${RESOURCE}Italy`, "http://schema.org/Place"),
            binding(`${RESOURCE}Italy`, "http://dbpedia.org/ontology/Country"),
            binding(`${RESOURCE}Bono`, "http://xmlns.com/foaf/0.1/Person")
          ]
        }
      }
    }));

    const types = await getEntityTypesByNames(["Italy", "Bono", "Unknown"]);
    expect(types.get("Italy")).toEqual(["schema:Place", "dbo:Country"]);
    expect(types.get("Bono")).toEqual(["foaf:Person"]);
    expect(types.has("Unknown")).toBe(false);
  });

  it("filters by the requested prefixes", async () => {
    installFetchMock(() => ({
      json: {
        results: {
          bindings: [
            binding(`${RESOURCE}Italy`, "http://schema.org/Place"),
            binding(`${RESOURCE}Italy`, "http://dbpedia.org/ontology/Country"),
            binding(`${RESOURCE}Italy`, "http://www.w3.org/2002/07/owl#Thing")
          ]
        }
      }
    }));

    const types = await getEntityTypesByNames(["Italy"], ["schema"]);
    expect(types.get("Italy")).toEqual(["schema:Place"]);
  });

  it("ignores types from unknown namespaces", async () => {
    installFetchMock(() => ({
      json: {
        results: {
          bindings: [binding(`${RESOURCE}X`, "http://unknown.example/Thing")]
        }
      }
    }));
    const types = await getEntityTypesByNames(["X"]);
    expect(types.get("X")).toEqual([]);
  });

  it("drops Person when DBpedia also says Place", async () => {
    installFetchMock(() => ({
      json: {
        results: {
          bindings: [
            binding(`${RESOURCE}Moscow`, "http://dbpedia.org/ontology/Person"),
            binding(`${RESOURCE}Moscow`, "http://dbpedia.org/ontology/Place")
          ]
        }
      }
    }));

    expect((await getEntityTypesByNames(["Moscow"])).get("Moscow")).toEqual([
      "dbo:Place"
    ]);
  });

  it("makes no request for an empty name list", async () => {
    const mock = installFetchMock(() => ({ json: {} }));
    expect((await getEntityTypesByNames([])).size).toBe(0);
    expect(mock.calls).toHaveLength(0);
  });
});

describe("getEntityTypesByName", () => {
  it("returns the types of a single name", async () => {
    installFetchMock(() => ({
      json: {
        results: {
          bindings: [binding(`${RESOURCE}Italy`, "http://schema.org/Place")]
        }
      }
    }));
    await expect(getEntityTypesByName("Italy")).resolves.toEqual([
      "schema:Place"
    ]);
  });

  it("returns an empty array when DBpedia knows nothing", async () => {
    installFetchMock(() => ({ json: { results: { bindings: [] } } }));
    await expect(getEntityTypesByName("Nope")).resolves.toEqual([]);
  });
});
