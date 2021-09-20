import {
  WikidataEntityClaims,
  WikidataProperty,
  WikidataPropertyValue
} from "../types";

// Expects an entity 'claims' object
// Ex: entity.claims
export function simplifyClaims(claims: any): WikidataEntityClaims {
  const simpleClaims: WikidataEntityClaims = {};
  for (let id in claims) {
    let propClaims = claims[id];
    simpleClaims[id] = simplifyPropertyClaims(propClaims, id);
    if (simpleClaims[id].values.length === 0) {
      delete simpleClaims[id];
    }
  }
  return simpleClaims;
}

// Expects the 'claims' array of a particular property
// Ex: entity.claims.P369
export function simplifyPropertyClaims(
  propClaims: any[],
  id: string
): WikidataProperty {
  const prop: WikidataProperty = {
    id,
    values: propClaims
      .map((claim) => simplifyClaim(claim))
      .filter((item) => item && (item.value_string || item.value !== null))
  };

  return prop;
}

// Expects a single claim object
// Ex: entity.claims.P369[0]
export function simplifyClaim(claim: any): WikidataPropertyValue {
  // tries to replace wikidata deep claim object by a simple value
  // e.g. a string, an entity Qid or an epoch time number
  const { mainsnak, qualifiers } = claim;

  // should only happen in snaktype: `novalue` cases or alikes
  if (mainsnak === null) return null;

  const { datatype, datavalue } = mainsnak;
  // known case: snaktype set to `somevalue`
  if (datavalue === null || datavalue === undefined || datavalue.value === null)
    return null;

  let value = null;
  let value_string;

  switch (datatype) {
    case "string":
    case "commonsMedia":
    case "url":
    case "external-id":
      value = datavalue.value;
      break;
    case "monolingualtext":
      value = datavalue.value.text;
      break;
    case "wikibase-item":
      value = datavalue.value.id;
      break;
    case "wikibase-property":
      value = datavalue.value;
      break;
    case "time":
      value = datavalue.value;
      value_string = stringDatetime(datavalue.value);
      break;
    case "quantity":
      value = datavalue.value;
      value_string = parseFloat(datavalue.value.amount).toString();
      break;
    case "globe-coordinate":
      value = datavalue.value;
      value_string = getLatLngFromCoordinates(datavalue.value).join(",");
      break;
  }

  const simpleQualifiers: Record<string, any> = {};

  for (let qualifierProp in qualifiers) {
    simpleQualifiers[qualifierProp] = qualifiers[qualifierProp].map(
      prepareQualifierClaim
    );
  }
  const result: any = {
    datatype,
    value,
    qualifiers: simplifyClaims(simpleQualifiers)
  };
  if (value_string) {
    result["value_string"] = value_string;
  }

  return result;
}

const getLatLngFromCoordinates = (value: {
  latitude: number;
  longitude: number;
}) => [
  value.latitude.toFixed(4).replace(/[0]+$/, "").replace(/\.$/, ""),
  value.longitude.toFixed(4).replace(/[0]+$/, "").replace(/\.$/, "")
];

const prepareQualifierClaim = (claim: any) => ({ mainsnak: claim });

const stringDatetime = (value: any) => {
  let date = value.time;
  const p = value.precision;
  if (p >= 9) {
    // year
    date = date.substr(1); // remove + sign
    if (p < 12) {
      // hour
      date = date.split("T")[0];
      if (p === 10) {
        // month
        date = date.split("-").slice(0, 2).join("-");
      } else if (p === 9) {
        // year
        date = date.split("-")[0];
      }
    }
  }

  return date;
};
