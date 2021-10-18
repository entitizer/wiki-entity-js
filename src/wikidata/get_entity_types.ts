import request from "../request";
import { StringPlainObject } from "../types";

const PREFIXES_MAP: StringPlainObject = {
  "http://www.ontologydesignpatterns.org/ont/dul/DUL.owl#": "dul",
  "http://dbpedia.org/ontology/": "dbo",
  "http://www.w3.org/2002/07/owl#": "owl",
  "http://www.wikidata.org/entity/": "wikidata",
  "http://schema.org/": "schema",
  "http://xmlns.com/foaf/0.1/": "foaf",
  "http://www.w3.org/2003/01/geo/wgs84_pos#": "geo"
};

const PREFIXES = Object.keys(PREFIXES_MAP).map((key) => PREFIXES_MAP[key]);
const PREFIXES_REG = new RegExp(
  "^(" + Object.keys(PREFIXES_MAP).join("|") + ")"
);

export function getEntityTypesByName(
  name: string,
  prefixes?: string[]
): Promise<string[]> {
  if (!prefixes || !prefixes.length) {
    prefixes = PREFIXES;
  }

  return dbpediaTypes(name)
    .then((types) => parseTypes(types))
    .then((types) => {
      return types
        .filter((item) => PREFIXES_REG.test(item))
        .map((item) => {
          const key = PREFIXES_REG.exec(item)[1];
          return PREFIXES_MAP[key] + ":" + item.substr(key.length);
        });
    })
    .then((types) => repairTypes(types));
}

function parseTypes(types: any[]): string[] {
  return types.map((item) => item.type.value);
}

function dbpediaTypes(name: string): Promise<any[]> {
  const url = `http://dbpedia.org/resource/${name
    .replace(/\s+/g, "_")
    .replace(/"/g, "%22")}`;
  const query = `SELECT ?type WHERE { <${url}> rdf:type ?type }`;
  return request<any>("http://dbpedia.org/sparql", {
    params: { query: query },
    timeout: 30 * 1000
  })
    .then((data) => data.results && data.results.bindings)
    .catch((error) => {
      console.error(`${error.message}: ${url}`);
      return [];
    });
}

function repairTypes(types: string[]) {
  const personIndex = types.findIndex((item) => /:Person$/.test(item));
  if (personIndex > -1) {
    const placeIndex = types.findIndex((item) => /:Place$/.test(item));
    if (placeIndex > -1) {
      types.splice(personIndex, 1);
    }
  }

  return types;
}
