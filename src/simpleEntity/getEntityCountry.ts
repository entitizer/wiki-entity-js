import { WikiEntity, WikidataProperty } from "../types";

const countries: {
  [id: string]: { id: string; cc2: string };
} = require("../../data/countries.json");

// const TypesKeys = Object.keys(TYPES_MAP);

export function getEntityCountryCode(wikiEntity: WikiEntity): string[] {
  if (!wikiEntity?.claims) {
    return null;
  }

  const countryIds = getEntityCountryIds(wikiEntity);
  const list: string[] = [];
  for (let id of countryIds) {
    if (countries[id]) {
      list.push(countries[id].cc2.toLowerCase());
    }
  }

  return list.length ? list : null;
}

function getEntityCountryIds(wikiEntity: WikiEntity): string[] {
  let prop: WikidataProperty =
    wikiEntity.claims.P17 ||
    wikiEntity.claims.P27 ||
    wikiEntity.claims.P495 ||
    wikiEntity.claims.P1532;

  return (prop && prop.values.map((item) => item.value)) || [];
}
