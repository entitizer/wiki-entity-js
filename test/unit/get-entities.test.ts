import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEntities,
  getSimpleEntities,
  mapRedirects,
  SimpleEntityType
} from "../../src/index";
import {
  installFetchMock,
  type MockResponseInit,
  type RecordedCall
} from "./helpers/mock-fetch";

afterEach(() => vi.unstubAllGlobals());

const wikidataEntity = (
  id: string,
  sitelinks: Record<string, string> = {},
  extra: object = {}
) => ({
  id,
  type: "item",
  // Wikidata's own page id, which must never leak out as `pageid`.
  pageid: 999_000,
  labels: { en: { language: "en", value: id } },
  sitelinks: Object.fromEntries(
    Object.entries(sitelinks).map(([lang, title]) => [`${lang}wiki`, { title }])
  ),
  ...extra
});

const wikiPage = (pageid: number, title: string, extra: object = {}) => ({
  pageid,
  ns: 0,
  title,
  ...extra
});

interface Routes {
  wikidata?: (call: RecordedCall) => MockResponseInit;
  wikipedia?: (call: RecordedCall) => MockResponseInit;
  dbpedia?: (call: RecordedCall) => MockResponseInit;
}

/** Route mock responses by host, so one test can drive all three APIs. */
function routeFetch(routes: Routes) {
  return installFetchMock((call) => {
    const host = call.url.host;
    if (host === "www.wikidata.org") {
      return routes.wikidata?.(call) ?? { json: { entities: {} } };
    }
    if (host.endsWith(".wikipedia.org")) {
      return routes.wikipedia?.(call) ?? { json: { query: { pages: [] } } };
    }
    if (host === "dbpedia.org") {
      return routes.dbpedia?.(call) ?? { json: { results: { bindings: [] } } };
    }
    throw new Error(`Unexpected request to ${call.url.toString()}`);
  });
}

describe("getEntities", () => {
  it("returns an empty array when nothing was found", async () => {
    const mock = routeFetch({});
    await expect(getEntities({ ids: ["Q1"] })).resolves.toEqual([]);
    // No point querying Wikipedia or DBpedia for zero entities.
    expect(mock.calls).toHaveLength(1);
  });

  it("returns entities in the order the ids were requested", async () => {
    routeFetch({
      wikidata: () => ({
        json: {
          entities: {
            // Deliberately out of order: the API may answer in any order.
            Q21197: wikidataEntity("Q21197"),
            Q2438184: wikidataEntity("Q2438184")
          }
        }
      })
    });

    const result = await getEntities({ ids: ["Q2438184", "Q21197"] });
    expect(result.map((e) => e.id)).toEqual(["Q2438184", "Q21197"]);
  });

  it("resolves a requested id that turned out to be a redirect", async () => {
    routeFetch({
      wikidata: () => ({
        json: {
          entities: {
            Q104772811: {
              ...wikidataEntity("Q104794561"),
              redirects: { from: "Q104772811", to: "Q104794561" }
            }
          }
        }
      })
    });

    const [entity] = await getEntities({ ids: ["Q104772811"] });
    expect(entity?.id).toBe("Q104794561");
    expect(entity?.redirectsToId).toBe("Q104794561");
  });

  it("finds a requested id under the key of its redirect target", async () => {
    routeFetch({
      wikidata: () => ({
        json: {
          entities: {
            // Keyed by the target, with the requested id only in `redirects`.
            Q104794561: {
              ...wikidataEntity("Q104794561"),
              redirects: { from: "Q104772811", to: "Q104794561" }
            },
            Q38: wikidataEntity("Q38")
          }
        }
      })
    });

    const result = await getEntities({ ids: ["Q104772811", "Q38"] });
    expect(result.map((e) => e.id)).toEqual(["Q104794561", "Q38"]);
  });

  it("still returns entities that match no requested id", async () => {
    routeFetch({
      wikidata: () => ({
        json: {
          entities: {
            Q38: wikidataEntity("Q38"),
            Q999: wikidataEntity("Q999")
          }
        }
      })
    });

    const result = await getEntities({ ids: ["Q38"] });
    expect(result.map((e) => e.id)).toEqual(["Q38", "Q999"]);
  });

  it("does not return the same entity twice", async () => {
    routeFetch({
      wikidata: () => ({
        json: { entities: { Q38: wikidataEntity("Q38") } }
      })
    });

    const result = await getEntities({ ids: ["Q38", "Q38"] });
    expect(result.map((e) => e.id)).toEqual(["Q38"]);
  });

  describe("Wikipedia enrichment", () => {
    it("attaches the Wikipedia page id, extract, redirects and categories", async () => {
      routeFetch({
        wikidata: () => ({
          json: {
            entities: { Q21197: wikidataEntity("Q21197", { en: "Chișinău" }) }
          }
        }),
        wikipedia: () => ({
          json: {
            query: {
              pages: [
                wikiPage(56635, "Chișinău", {
                  extract: "Chișinău is the capital of Moldova.",
                  redirects: [{ title: "Kishinev" }],
                  categories: [{ title: "Category:Chișinău" }]
                })
              ]
            }
          }
        })
      });

      const [entity] = await getEntities({
        ids: ["Q21197"],
        extract: 2,
        redirects: true,
        categories: true
      });

      expect(entity?.pageid).toBe(56635);
      expect(entity?.extract).toBe("Chișinău is the capital of Moldova.");
      expect(entity?.redirects).toEqual(["Kishinev"]);
      expect(entity?.categories).toEqual(["Category:Chișinău"]);
    });

    it("matches results back to entities through normalisation and redirects", async () => {
      routeFetch({
        wikidata: () => ({
          json: {
            entities: { Q76: wikidataEntity("Q76", { en: "Barack obama" }) }
          }
        }),
        wikipedia: () => ({
          json: {
            query: {
              // MediaWiki answers under the resolved title, not ours.
              normalized: [{ from: "Barack obama", to: "Barack Obama" }],
              redirects: [{ from: "Barack Obama", to: "Barack Obama" }],
              pages: [wikiPage(534366, "Barack Obama", { extract: "…" })]
            }
          }
        })
      });

      const [entity] = await getEntities({ ids: ["Q76"], extract: 1 });
      expect(entity?.pageid).toBe(534366);
      expect(entity?.extract).toBe("…");
    });

    it("uses the sitelink of the requested language", async () => {
      const mock = routeFetch({
        wikidata: () => ({
          json: {
            entities: {
              Q21197: wikidataEntity("Q21197", {
                en: "Chișinău",
                ro: "Chișinău (oraș)"
              })
            }
          }
        })
      });

      await getEntities({ ids: ["Q21197"], language: "ro" });

      const wikipediaCall = mock.calls.find((c) =>
        c.url.host.endsWith(".wikipedia.org")
      );
      expect(wikipediaCall?.url.host).toBe("ro.wikipedia.org");
      expect(wikipediaCall?.params.get("titles")).toBe("Chișinău (oraș)");
    });

    it("never reports Wikidata's own page id as `pageid`", async () => {
      routeFetch({
        wikidata: () => ({
          json: { entities: { Q1: wikidataEntity("Q1", { en: "One" }) } }
        }),
        // The article does not exist, so nothing enriches the entity.
        wikipedia: () => ({ json: { query: { pages: [] } } })
      });

      const [entity] = await getEntities({ ids: ["Q1"] });
      expect(entity?.pageid).toBeUndefined();
    });

    it("skips Wikipedia entirely when nothing needs it", async () => {
      const mock = routeFetch({
        wikidata: () => ({
          json: { entities: { Q1: wikidataEntity("Q1", { en: "One" }) } }
        })
      });

      const [entity] = await getEntities({ ids: ["Q1"], wikiPageId: false });
      expect(
        mock.calls.filter((c) => c.url.host.endsWith("wikipedia.org"))
      ).toHaveLength(0);
      expect(entity?.pageid).toBeUndefined();
    });

    it("does not call Wikipedia when no entity has a sitelink", async () => {
      const mock = routeFetch({
        wikidata: () => ({ json: { entities: { Q1: wikidataEntity("Q1") } } })
      });

      await getEntities({ ids: ["Q1"], extract: 1 });
      expect(
        mock.calls.filter((c) => c.url.host.endsWith("wikipedia.org"))
      ).toHaveLength(0);
    });
  });

  describe("DBpedia types", () => {
    it("resolves types for every entity in one query", async () => {
      const mock = routeFetch({
        wikidata: () => ({
          json: {
            entities: {
              Q38: wikidataEntity("Q38", { en: "Italy" }),
              Q142: wikidataEntity("Q142", { en: "France" })
            }
          }
        }),
        dbpedia: () => ({
          json: {
            results: {
              bindings: [
                {
                  s: { value: "http://dbpedia.org/resource/Italy" },
                  type: { value: "http://schema.org/Place" }
                },
                {
                  s: { value: "http://dbpedia.org/resource/France" },
                  type: { value: "http://schema.org/Country" }
                }
              ]
            }
          }
        })
      });

      const result = await getEntities({ ids: ["Q38", "Q142"], types: true });

      expect(result[0]?.types).toEqual(["schema:Place"]);
      expect(result[1]?.types).toEqual(["schema:Country"]);
      expect(
        mock.calls.filter((c) => c.url.host === "dbpedia.org")
      ).toHaveLength(1);
    });

    it("passes the prefix filter through", async () => {
      const mock = routeFetch({
        wikidata: () => ({
          json: { entities: { Q38: wikidataEntity("Q38", { en: "Italy" }) } }
        }),
        dbpedia: () => ({
          json: {
            results: {
              bindings: [
                {
                  s: { value: "http://dbpedia.org/resource/Italy" },
                  type: { value: "http://schema.org/Place" }
                },
                {
                  s: { value: "http://dbpedia.org/resource/Italy" },
                  type: { value: "http://dbpedia.org/ontology/Country" }
                }
              ]
            }
          }
        })
      });

      const [entity] = await getEntities({ ids: ["Q38"], types: ["dbo"] });
      expect(entity?.types).toEqual(["dbo:Country"]);
      expect(mock.calls.some((c) => c.url.host === "dbpedia.org")).toBe(true);
    });

    it("always uses the English sitelink, whatever the language", async () => {
      const mock = routeFetch({
        wikidata: () => ({
          json: {
            entities: {
              Q38: wikidataEntity("Q38", { en: "Italy", ro: "Italia" })
            }
          }
        })
      });

      await getEntities({ ids: ["Q38"], language: "ro", types: true });

      const query =
        mock.calls
          .find((c) => c.url.host === "dbpedia.org")
          ?.params.get("query") ?? "";
      expect(query).toContain("resource/Italy>");
      expect(query).not.toContain("resource/Italia>");
    });

    it("keeps the Wikidata data when DBpedia is down", async () => {
      routeFetch({
        wikidata: () => ({
          json: { entities: { Q38: wikidataEntity("Q38", { en: "Italy" }) } }
        }),
        dbpedia: () => ({ status: 503 })
      });

      const [entity] = await getEntities({ ids: ["Q38"], types: true });
      expect(entity?.id).toBe("Q38");
      expect(entity?.types).toBeUndefined();
    });

    it("does not query DBpedia unless types were requested", async () => {
      const mock = routeFetch({
        wikidata: () => ({
          json: { entities: { Q38: wikidataEntity("Q38", { en: "Italy" }) } }
        })
      });

      await getEntities({ ids: ["Q38"] });
      expect(mock.calls.some((c) => c.url.host === "dbpedia.org")).toBe(false);
    });
  });
});

describe("mapRedirects", () => {
  it("maps redirect titles to their targets", async () => {
    routeFetch({
      wikipedia: () => ({
        json: {
          query: {
            redirects: [{ from: "Brashov", to: "Brașov" }],
            pages: [wikiPage(1, "Brașov")]
          }
        }
      })
    });

    await expect(mapRedirects(["Brashov"], "ro")).resolves.toEqual({
      Brashov: "Brașov"
    });
  });

  it("asks the API to follow redirects", async () => {
    const mock = routeFetch({});
    await mapRedirects(["A"], "en");
    expect(mock.paramsOf(0).get("redirects")).toBe("1");
  });

  it("ignores titles that are only normalised, not redirected", async () => {
    routeFetch({
      wikipedia: () => ({
        json: {
          query: {
            normalized: [{ from: "brasov", to: "Brasov" }],
            pages: [wikiPage(1, "Brasov")]
          }
        }
      })
    });

    await expect(mapRedirects(["brasov"], "ro")).resolves.toEqual({});
  });

  it("makes no request for an empty title list", async () => {
    const mock = routeFetch({});
    await expect(mapRedirects([], "en")).resolves.toEqual({});
    expect(mock.calls).toHaveLength(0);
  });
});

describe("getSimpleEntities", () => {
  it("converts using the language the entities were fetched in", async () => {
    routeFetch({
      wikidata: () => ({
        json: {
          entities: {
            Q21197: {
              ...wikidataEntity("Q21197", {
                en: "Chișinău",
                ro: "Chișinău (oraș)"
              }),
              labels: { ro: { language: "ro", value: "Chișinău" } }
            }
          }
        }
      })
    });

    const [entity] = await getSimpleEntities({
      language: "ro",
      ids: ["Q21197"],
      wikiPageId: false
    });

    expect(entity?.lang).toBe("ro");
    expect(entity?.wikiDataId).toBe("Q21197");
    expect(entity?.name).toBe("Chișinău");
    // Read from the ro sitelink, not the en one.
    expect(entity?.wikiPageTitle).toBe("Chișinău (oraș)");
  });

  it("defaults to English when no language is given", async () => {
    routeFetch({
      wikidata: () => ({
        json: { entities: { Q38: wikidataEntity("Q38", { en: "Italy" }) } }
      })
    });

    const [entity] = await getSimpleEntities({
      ids: ["Q38"],
      wikiPageId: false
    });
    expect(entity?.lang).toBe("en");
  });

  it("passes options through to the converter", async () => {
    routeFetch({
      wikidata: () => ({
        json: { entities: { Q1: wikidataEntity("Q1") } }
      })
    });

    const [entity] = await getSimpleEntities(
      { ids: ["Q1"], wikiPageId: false },
      { defaultType: SimpleEntityType.WORK }
    );
    expect(entity?.type).toBe(SimpleEntityType.WORK);
  });

  it("returns an empty array when nothing was found", async () => {
    routeFetch({});
    await expect(getSimpleEntities({ ids: ["Q1"] })).resolves.toEqual([]);
  });
});
