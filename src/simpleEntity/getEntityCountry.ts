import { WikiEntity, WikidataProperty } from "../types";

const countries = require('../../data/countries.json');

// const TypesKeys = Object.keys(TYPES_MAP);

export function getEntityCountryCode(wikiEntity: WikiEntity): string {
    if (!wikiEntity) {
        return null;
    }

    const countryIds = getEntityCountryIds(wikiEntity);

    for (var i = 0; i < countryIds.length; i++) {
        const id = countryIds[i];
        if (countries[id]) {
            return countries[id].cc2;
        }
    }

    return null;
}

function getEntityCountryIds(wikiEntity: WikiEntity): string[] {
    let prop: WikidataProperty = wikiEntity.claims.P17 || wikiEntity.claims.P27 || wikiEntity.claims.P495 || wikiEntity.claims.P1532;

    return prop && prop.values.map(item => item.value) || [];
}
