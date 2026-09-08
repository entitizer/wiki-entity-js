import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, ApiError } from "../../src/errors";
import {
  buildSearchParams,
  getUserAgent,
  request,
  setUserAgent
} from "../../src/request";
import { installFetchMock } from "./helpers/mock-fetch";

const URL_UNDER_TEST = "https://example.test/api";

afterEach(() => {
  vi.unstubAllGlobals();
  setUserAgent("wiki-entity-test/1.0 (https://example.test)");
});

describe("buildSearchParams", () => {
  it("joins array values with a pipe, as the MediaWiki API expects", () => {
    const params = buildSearchParams({ languages: ["en", "ru", "de"] });
    expect(params.get("languages")).toBe("en|ru|de");
    // PHP array syntax is what the previous axios-based client emitted.
    expect(params.has("languages[]")).toBe(false);
    expect(params.toString()).toBe("languages=en%7Cru%7Cde");
  });

  it("drops null, undefined and empty arrays", () => {
    const params = buildSearchParams({
      a: undefined,
      b: null,
      c: [],
      d: "keep"
    });
    expect([...params.keys()]).toEqual(["d"]);
  });

  it("stringifies numbers and booleans", () => {
    const params = buildSearchParams({ n: 3, b: true });
    expect(params.get("n")).toBe("3");
    expect(params.get("b")).toBe("true");
  });
});

describe("user agent", () => {
  it("is sent with every request", async () => {
    setUserAgent("MyApp/2.0 (https://myapp.test)");
    const mock = installFetchMock(() => ({ json: { ok: true } }));

    await request(URL_UNDER_TEST, {});

    expect(mock.calls[0]?.headers.get("user-agent")).toBe(
      "MyApp/2.0 (https://myapp.test)"
    );
    expect(getUserAgent()).toBe("MyApp/2.0 (https://myapp.test)");
  });

  it("rejects an empty user agent", () => {
    expect(() => setUserAgent("")).toThrow(TypeError);
    expect(() => setUserAgent("   ")).toThrow(TypeError);
  });
});

describe("request", () => {
  it("returns the parsed JSON body", async () => {
    installFetchMock(() => ({ json: { hello: "world" } }));
    await expect(request(URL_UNDER_TEST, {})).resolves.toEqual({
      hello: "world"
    });
  });

  it("merges params into the URL query string", async () => {
    const mock = installFetchMock(() => ({ json: {} }));
    await request(URL_UNDER_TEST + "?existing=1", {
      params: { action: "query", titles: ["A", "B"] }
    });
    expect(mock.paramsOf(0).get("existing")).toBe("1");
    expect(mock.paramsOf(0).get("action")).toBe("query");
    expect(mock.paramsOf(0).get("titles")).toBe("A|B");
  });

  it("does not retry a 4xx response", async () => {
    const mock = installFetchMock(() => ({ status: 404 }));
    await expect(request(URL_UNDER_TEST, {})).rejects.toBeInstanceOf(HttpError);
    expect(mock.calls).toHaveLength(1);
  });

  it("retries a 5xx response and succeeds", async () => {
    const mock = installFetchMock((_call, index) =>
      index === 0 ? { status: 503 } : { json: { ok: 1 } }
    );
    await expect(request(URL_UNDER_TEST, { retries: 1 })).resolves.toEqual({
      ok: 1
    });
    expect(mock.calls).toHaveLength(2);
  });

  it("retries a transport failure", async () => {
    const mock = installFetchMock((_call, index) =>
      index === 0 ? new TypeError("network down") : { json: { ok: 1 } }
    );
    await expect(request(URL_UNDER_TEST, { retries: 1 })).resolves.toEqual({
      ok: 1
    });
    expect(mock.calls).toHaveLength(2);
  });

  it("honours a Retry-After header on 429", async () => {
    const started = Date.now();
    const mock = installFetchMock((_call, index) =>
      index === 0
        ? { status: 429, headers: { "retry-after": "0.3" } }
        : { json: { ok: 1 } }
    );
    await request(URL_UNDER_TEST, { retries: 1 });
    expect(mock.calls).toHaveLength(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it("gives up after the configured number of retries", async () => {
    const mock = installFetchMock(() => ({
      status: 500,
      headers: { "retry-after": "0" }
    }));
    await expect(
      request(URL_UNDER_TEST, { retries: 2 })
    ).rejects.toBeInstanceOf(HttpError);
    expect(mock.calls).toHaveLength(3);
  });

  it("reports a non-JSON body as an ApiError", async () => {
    installFetchMock(() => ({ body: "<html>oops</html>" }));
    await expect(request(URL_UNDER_TEST, {})).rejects.toBeInstanceOf(ApiError);
  });

  it("stops immediately when the caller aborts", async () => {
    const controller = new AbortController();
    const mock = installFetchMock(() => {
      controller.abort();
      return new TypeError("aborted by test");
    });

    await expect(
      request(URL_UNDER_TEST, { retries: 3, signal: controller.signal })
    ).rejects.toThrow();
    expect(mock.calls).toHaveLength(1);
  });
});

describe("HttpError", () => {
  it("treats 429 and 5xx as retryable", () => {
    expect(new HttpError("x", "u", 429).retryable).toBe(true);
    expect(new HttpError("x", "u", 503).retryable).toBe(true);
    expect(new HttpError("x", "u", 404).retryable).toBe(false);
    expect(new HttpError("x", "u").retryable).toBe(true);
  });

  it("keeps its class name", () => {
    expect(new HttpError("x", "u", 404).name).toBe("HttpError");
  });
});
