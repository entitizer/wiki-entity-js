import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/errors";
import { getEntities, getManyEntities } from "../../src/wikidata/api";
import { installFetchMock } from "./helpers/mock-fetch";

afterEach(() => vi.unstubAllGlobals());

const entity = (id: string) => ({ id, type: "item", pageid: 1 });

describe("validateParams", () => {
  it("requires a non-empty ids or titles array", async () => {
    await expect(getEntities({})).rejects.toBeInstanceOf(TypeError);
    await expect(getEntities({ ids: [] })).rejects.toBeInstanceOf(TypeError);
    await expect(getManyEntities({ titles: [] })).rejects.toBeInstanceOf(
      TypeError
    );
  });
});

describe("getEntities", () => {
  it("sends ids and props as pipe separated values", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getEntities({ ids: ["Q1", "Q2"], props: ["labels", "claims"] });

    const params = mock.paramsOf(0);
    expect(params.get("action")).toBe("wbgetentities");
    expect(params.get("ids")).toBe("Q1|Q2");
    expect(params.get("props")).toBe("labels|claims");
    expect(params.get("redirects")).toBe("yes");
  });

  it("sends `languages` as a pipe separated list, not PHP array syntax", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getEntities({ ids: ["Q1"], languages: ["en", "ru", "de"] });

    expect(mock.paramsOf(0).get("languages")).toBe("en|ru|de|mul");
    // The previous axios client emitted `languages[]=en&languages[]=ru`,
    // which MediaWiki rejects with a warning and then ignores.
    expect(mock.paramsOf(0).has("languages[]")).toBe(false);
  });

  it("always asks for `mul` alongside the requested languages", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getEntities({ ids: ["Q1"], languages: ["en", "ru"] });
    expect(mock.paramsOf(0).get("languages")).toBe("en|ru|mul");
  });

  it("does not duplicate `mul` when it was requested explicitly", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getEntities({ ids: ["Q1"], languages: ["mul", "en"] });
    expect(mock.paramsOf(0).get("languages")).toBe("mul|en");
  });

  it("leaves `languages` unset when the caller did not filter", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getEntities({ ids: ["Q1"] });
    expect(mock.paramsOf(0).has("languages")).toBe(false);
  });

  it("normalises a single title so Wikipedia redirects resolve", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getEntities({ titles: ["Brashov"], language: "ro" });
    expect(mock.paramsOf(0).get("normalize")).toBe("1");
  });

  it("omits `normalize` for multiple titles, which the API rejects", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getEntities({ titles: ["A", "B"], language: "ro" });
    expect(mock.paramsOf(0).has("normalize")).toBe(false);
  });

  it("derives `sites` from the language when querying by title", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getEntities({ titles: ["Roma"], language: "it" });

    expect(mock.paramsOf(0).get("sites")).toBe("itwiki");
    expect(mock.paramsOf(0).get("titles")).toBe("Roma");
  });

  it("omits `sites` when querying by id", async () => {
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getEntities({ ids: ["Q1"] });
    expect(mock.paramsOf(0).has("sites")).toBe(false);
  });

  it("drops missing entities and non-entity keys", async () => {
    installFetchMock(() => ({
      json: {
        entities: {
          Q42: entity("Q42"),
          Q7759840: { id: "Q7759840", missing: "" },
          "-1": { site: "enwiki", title: "Nope", missing: "" }
        }
      }
    }));

    const result = await getEntities({ ids: ["Q42", "Q7759840"] });
    expect(Object.keys(result)).toEqual(["Q42"]);
  });

  it("keeps property entities", async () => {
    installFetchMock(() => ({
      json: { entities: { P31: { id: "P31", datatype: "wikibase-item" } } }
    }));

    const result = await getEntities({ ids: ["P31"] });
    expect(Object.keys(result)).toEqual(["P31"]);
  });

  it("exposes redirect information", async () => {
    installFetchMock(() => ({
      json: {
        entities: {
          Q104772811: {
            id: "Q104794561",
            redirects: { from: "Q104772811", to: "Q104794561" }
          }
        }
      }
    }));

    const result = await getEntities({ ids: ["Q104772811"] });
    expect(result["Q104772811"]?.redirectsToId).toBe("Q104794561");
    expect(result["Q104772811"]?.redirectsFromId).toBe("Q104772811");
  });

  it("turns an API error payload into an ApiError", async () => {
    installFetchMock(() => ({
      json: { error: { code: "no-such-entity", info: "Could not find" } }
    }));

    await expect(getEntities({ ids: ["Q1"] })).rejects.toMatchObject({
      name: "ApiError",
      code: "no-such-entity",
      message: "Could not find"
    });
    await expect(getEntities({ ids: ["Q1"] })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getManyEntities", () => {
  it("batches ids 50 at a time", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `Q${i + 1}`);
    const mock = installFetchMock((call) => {
      const requested = call.params.get("ids")?.split("|") ?? [];
      return {
        json: {
          entities: Object.fromEntries(requested.map((id) => [id, entity(id)]))
        }
      };
    });

    const result = await getManyEntities({ ids });

    expect(mock.calls).toHaveLength(3);
    expect(mock.paramsOf(0).get("ids")?.split("|")).toHaveLength(50);
    expect(mock.paramsOf(2).get("ids")?.split("|")).toHaveLength(20);
    expect(Object.keys(result)).toHaveLength(120);
  });

  it("never emits an empty trailing batch on an exact multiple of 50", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `Q${i + 1}`);
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getManyEntities({ ids });
    expect(mock.calls).toHaveLength(2);
  });

  it("preserves the requested order across batches", async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `Q${i + 1}`);
    installFetchMock((call) => {
      const requested = call.params.get("ids")?.split("|") ?? [];
      return {
        json: {
          entities: Object.fromEntries(requested.map((id) => [id, entity(id)]))
        }
      };
    });

    const result = await getManyEntities({ ids });
    expect(Object.keys(result)).toEqual(ids);
  });

  it("caps the request at 500 ids", async () => {
    const ids = Array.from({ length: 700 }, (_, i) => `Q${i + 1}`);
    const mock = installFetchMock(() => ({ json: { entities: {} } }));
    await getManyEntities({ ids });
    expect(mock.calls).toHaveLength(10);
  });

  it("returns an empty object rather than null when nothing matches", async () => {
    installFetchMock(() => ({ json: { entities: {} } }));
    await expect(getManyEntities({ ids: ["Q1"] })).resolves.toEqual({});
  });
});

describe("getManyEntities by title", () => {
  const found = (id: string) => ({ id, type: "item" });
  const missing = (title: string) => ({ site: "enwiki", title, missing: "" });

  /** Serve wbgetentities from `pages`, and Wikipedia from `redirects`. */
  function routeTitles(
    pages: Record<string, string | null>,
    redirects: Record<string, string> = {}
  ) {
    return installFetchMock((call) => {
      if (call.url.host === "www.wikidata.org") {
        const titles = call.params.get("titles")?.split("|") ?? [];
        const entities: Record<string, object> = {};
        let missingIndex = 0;
        // The API groups the misses first, then answers in request order.
        for (const title of titles) {
          if (!pages[title]) entities[`-${++missingIndex}`] = missing(title);
        }
        for (const title of titles) {
          const id = pages[title];
          if (id) entities[id] = found(id);
        }
        return { json: { entities } };
      }

      const titles = call.params.get("titles")?.split("|") ?? [];
      return {
        json: {
          query: {
            redirects: titles
              .filter((title) => redirects[title])
              .map((title) => ({ from: title, to: redirects[title] })),
            pages: titles.map((title) => ({
              pageid: 1,
              title: redirects[title] ?? title
            }))
          }
        }
      };
    });
  }

  it("returns entities in the order the titles were requested", async () => {
    routeTitles({ Italy: "Q38", France: "Q142", Spain: "Q29" });

    const result = await getManyEntities({
      titles: ["France", "Spain", "Italy"]
    });
    expect(Object.keys(result)).toEqual(["Q142", "Q29", "Q38"]);
  });

  it("keeps the order when some titles do not exist", async () => {
    routeTitles({ Italy: "Q38", Nope: null, France: "Q142" });

    const result = await getManyEntities({
      titles: ["Italy", "Nope", "France"]
    });
    expect(Object.keys(result)).toEqual(["Q38", "Q142"]);
  });

  it("retries an unresolved title against Wikipedia's canonical title", async () => {
    const mock = routeTitles(
      { Brashov: null, Brașov: "Q82174" },
      { Brashov: "Brașov" }
    );

    const result = await getManyEntities({
      titles: ["Brashov"],
      language: "ro"
    });

    expect(Object.keys(result)).toEqual(["Q82174"]);
    // wbgetentities, then Wikipedia to resolve, then wbgetentities again.
    expect(mock.calls.map((c) => c.url.host)).toEqual([
      "www.wikidata.org",
      "ro.wikipedia.org",
      "www.wikidata.org"
    ]);
  });

  it("places a retried title back in the requested order", async () => {
    routeTitles(
      { Italy: "Q38", Brashov: null, Brașov: "Q82174", France: "Q142" },
      { Brashov: "Brașov" }
    );

    const result = await getManyEntities({
      titles: ["Italy", "Brashov", "France"]
    });
    expect(Object.keys(result)).toEqual(["Q38", "Q82174", "Q142"]);
  });

  it("does not call Wikipedia when every title resolved", async () => {
    const mock = routeTitles({ Italy: "Q38" });
    await getManyEntities({ titles: ["Italy"] });
    expect(mock.calls).toHaveLength(1);
  });

  it("gives up quietly when Wikipedia does not know the title either", async () => {
    routeTitles({ NoSuchPage: null });
    await expect(getManyEntities({ titles: ["NoSuchPage"] })).resolves.toEqual(
      {}
    );
  });
});
