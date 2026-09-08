import { vi } from "vitest";

export interface MockResponseInit {
  status?: number;
  json?: unknown;
  body?: string;
  headers?: Record<string, string>;
}

export interface RecordedCall {
  url: URL;
  params: URLSearchParams;
  headers: Headers;
}

export type Responder = (
  call: RecordedCall,
  index: number
) => MockResponseInit | Error | Promise<MockResponseInit | Error>;

export interface FetchMock {
  calls: RecordedCall[];
  /** Query parameters of the n-th call. */
  paramsOf(index: number): URLSearchParams;
}

/**
 * Replace `globalThis.fetch` with a recorder driven by `responder`.
 * Returning an `Error` from the responder simulates a transport failure.
 */
export function installFetchMock(responder: Responder): FetchMock {
  const calls: RecordedCall[] = [];

  const impl = async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = new URL(
      typeof input === "string" || input instanceof URL
        ? String(input)
        : input.url
    );
    const call: RecordedCall = {
      url,
      params: url.searchParams,
      headers: new Headers(init?.headers)
    };
    const index = calls.length;
    calls.push(call);

    const result = await responder(call, index);
    if (result instanceof Error) throw result;

    const body = result.body ?? JSON.stringify(result.json ?? {});
    return new Response(body, {
      status: result.status ?? 200,
      headers: { "content-type": "application/json", ...result.headers }
    });
  };

  vi.stubGlobal("fetch", vi.fn(impl));

  return {
    calls,
    paramsOf(index) {
      const call = calls[index];
      if (!call) throw new Error(`No fetch call at index ${index}`);
      return call.params;
    }
  };
}
