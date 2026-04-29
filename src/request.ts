import axios, { AxiosRequestConfig } from "axios";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg: {
  name: string;
  version: string;
  homepage?: string;
  bugs?: { url?: string };
} = require("../package.json");

export type RequestOptions = AxiosRequestConfig;

const DEFAULT_USER_AGENT =
  process.env.WIKI_ENTITY_USER_AGENT ||
  `${pkg.name}/${pkg.version} (${
    pkg.homepage ||
    (pkg.bugs && pkg.bugs.url) ||
    "https://github.com/entitizer/wiki-entity"
  })`;

let userAgent = DEFAULT_USER_AGENT;

export function setUserAgent(ua: string): void {
  if (!ua || typeof ua !== "string") {
    throw new Error("User-Agent must be a non-empty string");
  }
  userAgent = ua;
}

export function getUserAgent(): string {
  return userAgent;
}

export default async function request<T>(
  url: string,
  options: RequestOptions,
): Promise<T> {
  const response = await axios(url, {
    method: "GET",
    responseType: "json",
    timeout: 15 * 1000,
    ...options,
    headers: {
      "User-Agent": userAgent,
      "Accept-Encoding": "gzip",
      ...(options.headers || {}),
    },
  });

  return response.data as T;
}
