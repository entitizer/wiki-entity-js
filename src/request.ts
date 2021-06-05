import axios, { AxiosRequestConfig } from "axios";

export type RequestOptions = AxiosRequestConfig;

export default async function <T>(
  url: string,
  options: RequestOptions
): Promise<T> {
  const response = await axios(url, {
    method: "GET",
    responseType: "json",
    headers: { "User-Agent": "entity-finder" },
    ...options,
    timeout: options.timeout || 10 * 1000
  });

  return response.data;
}
