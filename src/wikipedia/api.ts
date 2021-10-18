import { StringPlainObject } from "../utils";
import request from "../request";

const API_URL = "https://$lang.wikipedia.org/w/api.php";

export type ExtractType = {
  pageid: number;
  title: string;
  extract: string;
};

export type ExtractsParamsType = {
  lang: string;
  titles: string[];
  sentences?: number;
};

export type ApiResult = {
  pageid: number;
  title: string;
  extract?: string;
  categories?: string[];
  redirects?: string[];
};

export class Api {
  constructor(
    private qs: StringPlainObject = { action: "query", format: "json" },
    private httpTimeout?: number
  ) {
    this.qs.action = this.qs.action || "query";
    this.qs.format = "json";
    this.httpTimeout = httpTimeout || 10 * 1000;
  }

  async query(lang: string, qs?: StringPlainObject): Promise<ApiResult[]> {
    if (qs) this.qs = Object.assign({}, this.qs, qs);

    const data = await request<any>(API_URL.replace("$lang", lang), {
      params: this.qs,
      timeout: this.httpTimeout
    });

    if (hasError(data)) throw getError(data);

    if (data && data.query && data.query.pages) {
      return Object.keys(data.query.pages)
        .map((id) => data.query.pages[id])
        .map((data) => {
          const item: ApiResult = {
            pageid: data.pageid,
            title: data.title
          };

          if (data["categories"]) {
            item.categories = data["categories"].map((it: any) => it.title);
          }

          if (data["redirects"]) {
            item.redirects = data["redirects"].map((it: any) => it.title);
          }

          if (data["extract"]) {
            item.extract = data["extract"];
          }

          return item;
        });
    }
    return [];
  }

  redirects() {
    this.qs["rdlimit"] = "max";
    this.addField("prop", "redirects");
    return this;
  }

  categories() {
    this.qs["cllimit"] = "max";
    this.qs["clshow"] = "!hidden";
    this.addField("prop", "categories");
    return this;
  }

  extract(sentences: number = 3) {
    this.qs["exsentences"] = sentences.toString();
    this.qs["explaintext"] = "true";
    this.addField("prop", "extracts");
    return this;
  }

  private addField(name: string, value: string) {
    const vals = (this.qs[name] || "").split("|").filter((item) => !!item);
    vals.push(value);
    this.qs[name] = vals.join("|");

    return this;
  }
}

export async function getExtracts(
  params: ExtractsParamsType
): Promise<ExtractType[]> {
  const qs = {
    action: "query",
    titles: params.titles && params.titles.join("|"),
    exsentences: params.sentences || 3,
    prop: "extracts",
    explaintext: true,
    exintro: true,
    exlimit: "max",
    exsectionformat: "plain",
    format: "json"
  };

  const data = await request<any>(API_URL.replace("$lang", params.lang), {
    params: qs
  });

  if (hasError(data)) throw getError(data);

  if (data && data.query && data.query.pages) {
    return Object.keys(data.query.pages).map((id) => data.query.pages[id]);
  }

  return [];
}

export const getExtract = (
  lang: string,
  title: string,
  sentences?: number
): Promise<ExtractType | null> =>
  getExtracts({
    lang: lang,
    titles: [title],
    sentences: sentences
  }).then(function (extracts) {
    if (extracts.length) {
      return extracts[0];
    }
    return null;
  });

export async function getRedirects(
  lang: string,
  title: string
): Promise<string[]> {
  const qs = {
    action: "query",
    generator: "redirects",
    titles: title,
    grdlimit: "max",
    format: "json"
  };

  const data = await request<any>(API_URL.replace("$lang", lang), {
    params: qs
  });

  if (hasError(data)) throw getError(data);

  if (data && data.query && data.query.pages) {
    return Object.keys(data.query.pages).map(
      (id) => data.query.pages[id].title
    );
  }
  return [];
}

function getError(data: any): Error {
  return (
    (data &&
      data.error &&
      new Error(data.error.info || "Wikidata Api Error")) ||
    new Error("NO error")
  );
}

function hasError(data: any): boolean {
  return !!data.error;
}
