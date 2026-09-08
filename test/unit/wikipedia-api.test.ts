import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/errors";
import { queryPages } from "../../src/wikipedia/api";
import { installFetchMock } from "./helpers/mock-fetch";

afterEach(() => vi.unstubAllGlobals());

const page = (pageid: number, title: string, extra: object = {}) => ({
  pageid,
  ns: 0,
  title,
  ...extra
});

describe("queryPages", () => {
  it("targets the language's Wikipedia", async () => {
    const mock = installFetchMock(() => ({ json: { query: { pages: [] } } }));
    await queryPages({ lang: "ro", titles: ["Brașov"] });
    expect(mock.calls[0]?.url.host).toBe("ro.wikipedia.org");
  });

  it("requests exintro and exlimit so every title gets an extract", async () => {
    const mock = installFetchMock(() => ({ json: { query: { pages: [] } } }));
    await queryPages({ lang: "en", titles: ["A", "B"], extract: 2 });

    const params = mock.paramsOf(0);
    expect(params.get("prop")).toBe("extracts");
    expect(params.get("exsentences")).toBe("2");
    expect(params.get("explaintext")).toBe("1");
    // Without these two, MediaWiki lowers exlimit to 1 and only the first
    // title comes back with an extract.
    expect(params.get("exintro")).toBe("1");
    expect(params.get("exlimit")).toBe("max");
  });

  it("batches extract requests 20 at a time and others 50 at a time", async () => {
    const titles = Array.from({ length: 60 }, (_, i) => `T${i}`);
    const mock = installFetchMock(() => ({ json: { query: { pages: [] } } }));

    await queryPages({ lang: "en", titles, extract: 1 });
    expect(mock.calls).toHaveLength(3);

    vi.unstubAllGlobals();
    const plain = installFetchMock(() => ({ json: { query: { pages: [] } } }));
    await queryPages({ lang: "en", titles });
    expect(plain.calls).toHaveLength(2);
  });

  it("combines several props in one request", async () => {
    const mock = installFetchMock(() => ({ json: { query: { pages: [] } } }));
    await queryPages({
      lang: "en",
      titles: ["A"],
      extract: 1,
      redirects: true,
      categories: true
    });

    expect(mock.paramsOf(0).get("prop")).toBe("extracts|redirects|categories");
    expect(mock.paramsOf(0).get("rdlimit")).toBe("max");
    expect(mock.paramsOf(0).get("clshow")).toBe("!hidden");
  });

  it("maps normalised titles back to what was requested", async () => {
    installFetchMock(() => ({
      json: {
        query: {
          normalized: [{ from: "barack_obama", to: "Barack obama" }],
          redirects: [{ from: "Barack obama", to: "Barack Obama" }],
          pages: [page(534366, "Barack Obama")]
        }
      }
    }));

    const result = await queryPages({
      lang: "en",
      titles: ["barack_obama"],
      followRedirects: true
    });

    expect(result.requestedTitleOf.get("Barack Obama")).toBe("barack_obama");
    expect(result.resolved.get("barack_obama")).toEqual({
      title: "Barack Obama",
      redirected: true
    });
  });

  it("marks a pure normalisation as not redirected", async () => {
    installFetchMock(() => ({
      json: {
        query: {
          normalized: [{ from: "brasov", to: "Brasov" }],
          pages: [page(1, "Brasov")]
        }
      }
    }));

    const result = await queryPages({ lang: "ro", titles: ["brasov"] });
    expect(result.resolved.get("brasov")?.redirected).toBe(false);
  });

  it("follows continuations and merges the extra list values", async () => {
    installFetchMock((_call, index) =>
      index === 0
        ? {
            json: {
              continue: { rdcontinue: "1", continue: "||" },
              query: {
                pages: [
                  page(1, "A", {
                    redirects: [{ title: "A1" }, { title: "A2" }]
                  })
                ]
              }
            }
          }
        : {
            json: {
              query: {
                pages: [page(1, "A", { redirects: [{ title: "A3" }] })]
              }
            }
          }
    );

    const result = await queryPages({
      lang: "en",
      titles: ["A"],
      redirects: true
    });

    expect(result.pages[0]?.redirects).toEqual(["A1", "A2", "A3"]);
  });

  it("passes the continuation parameters back to the API", async () => {
    const mock = installFetchMock((_call, index) =>
      index === 0
        ? { json: { continue: { clcontinue: "1|X" }, query: { pages: [] } } }
        : { json: { query: { pages: [] } } }
    );

    await queryPages({ lang: "en", titles: ["A"], categories: true });
    expect(mock.calls).toHaveLength(2);
    expect(mock.paramsOf(1).get("clcontinue")).toBe("1|X");
  });

  it("skips missing pages", async () => {
    installFetchMock(() => ({
      json: {
        query: {
          pages: [{ ns: 0, title: "Nope", missing: true }, page(2, "Yes")]
        }
      }
    }));

    const result = await queryPages({ lang: "en", titles: ["Nope", "Yes"] });
    expect(result.pages.map((p) => p.title)).toEqual(["Yes"]);
  });

  it("understands the legacy object-keyed pages shape", async () => {
    installFetchMock(() => ({
      json: { query: { pages: { "5": page(5, "Legacy") } } }
    }));

    const result = await queryPages({ lang: "en", titles: ["Legacy"] });
    expect(result.pages).toEqual([{ pageid: 5, title: "Legacy" }]);
  });

  it("de-duplicates the requested titles", async () => {
    const mock = installFetchMock(() => ({ json: { query: { pages: [] } } }));
    await queryPages({ lang: "en", titles: ["A", "A", "B"] });
    expect(mock.paramsOf(0).get("titles")).toBe("A|B");
  });

  it("makes no request for an empty title list", async () => {
    const mock = installFetchMock(() => ({ json: {} }));
    const result = await queryPages({ lang: "en", titles: [] });
    expect(mock.calls).toHaveLength(0);
    expect(result.pages).toEqual([]);
  });

  it("turns an API error payload into an ApiError", async () => {
    installFetchMock(() => ({
      json: { error: { code: "badvalue", info: "Bad value" } }
    }));
    await expect(
      queryPages({ lang: "en", titles: ["A"] })
    ).rejects.toBeInstanceOf(ApiError);
  });
});
