

import { WikidataEntityClaims, WikidataProperty, WikidataPropertyValue } from './types';

// Expects an entity 'claims' object
// Ex: entity.claims
export function simplifyClaims(claims: any): WikidataEntityClaims {
    const simpleClaims:WikidataEntityClaims = {};
    for (let id in claims) {
        let propClaims = claims[id];
        simpleClaims[id] = simplifyPropertyClaims(propClaims, id);
    }
    return simpleClaims;
}

// Expects the 'claims' array of a particular property
// Ex: entity.claims.P369
export function simplifyPropertyClaims(propClaims: any[], id: string): WikidataProperty {
    const prop: WikidataProperty = {
        id,
        values: propClaims.map((claim) => simplifyClaim(claim)).filter(nonNull)
    };

    return prop;
}

// Expects a single claim object
// Ex: entity.claims.P369[0]
export function simplifyClaim(claim): WikidataPropertyValue {
    // tries to replace wikidata deep claim object by a simple value
    // e.g. a string, an entity Qid or an epoch time number
    const { mainsnak, qualifiers } = claim

    // should only happen in snaktype: `novalue` cases or alikes
    if (mainsnak === null) return null

    const { datatype, datavalue } = mainsnak
    // known case: snaktype set to `somevalue`
    if (datavalue === null) return null

    let value = null
    let value_string;

    switch (datatype) {
        case 'string':
        case 'commonsMedia':
        case 'url':
        case 'external-id':
            value = datavalue.value
            break
        case 'monolingualtext':
            value = datavalue.value.text
            break
        case 'wikibase-item':
            value = datavalue.value.id;
            break
        case 'wikibase-property':
            value = datavalue.value;
            break
        case 'time':
            value = datavalue.value.time;
            break
        case 'quantity':
            value = parseFloat(datavalue.value.amount)
            break
        case 'globe-coordinate':
            value = getLatLngFromCoordinates(datavalue.value)
            break
    }

    const simpleQualifiers = {}

    for (let qualifierProp in qualifiers) {
        simpleQualifiers[qualifierProp] = qualifiers[qualifierProp]
            .map(prepareQualifierClaim)
    }
    const result = {
        datatype,
        value,
        // qualifiers: simplifyClaims(simpleQualifiers, opts)
    };

    // if (Array.isArray(result) && result.length === 0 || Object.keys(result.qualifiers).length === 0) {
    //     delete result.qualifiers;
    // }

    return result;
}

const getLatLngFromCoordinates = (value) => [value.latitude, value.longitude]

const prepareQualifierClaim = (claim) => ({ mainsnak: claim })
const nonNull = (obj) => obj != null
