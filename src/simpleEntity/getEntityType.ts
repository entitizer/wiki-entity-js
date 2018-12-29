
import { PlainObject } from '../utils';
import { SimpleEntityType } from './simpleEntity';
import { WikiEntity } from '../types';

const TYPES_MAP: PlainObject<SimpleEntityType> = {
    'dbo:FictionalCharacter': SimpleEntityType.WORK,
    'wikidata:Q95074': SimpleEntityType.WORK,
    // 'dbo:Work': SimpleEntityType.WORK,
    // 'dbo:WrittenWork': SimpleEntityType.WORK,
    // 'schema:CreativeWork': SimpleEntityType.WORK,
    'dbo:Book': SimpleEntityType.WORK,
    // 'wikidata:Q386724': SimpleEntityType.WORK,
    'wikidata:Q571': SimpleEntityType.WORK,
    // 'dbo:Newspaper': SimpleEntityType.WORK,

    'dbo:PopulatedPlace': SimpleEntityType.PLACE,
    'dbo:Place': SimpleEntityType.PLACE,
    'schema:Place': SimpleEntityType.PLACE,
    'schema:City': SimpleEntityType.PLACE,
    'dbo:Location': SimpleEntityType.PLACE,
    'wikidata:Q515': SimpleEntityType.PLACE,
    'wikidata:Q486972': SimpleEntityType.PLACE,

    'dbo:Company': SimpleEntityType.ORG,
    'schema:Organization': SimpleEntityType.ORG,
    'dbo:Organisation': SimpleEntityType.ORG,
    'wikidata:Q43229': SimpleEntityType.ORG,

    'schema:Person': SimpleEntityType.PERSON,
    'wikidata:Q215627': SimpleEntityType.PERSON,
    'dul:NaturalPerson': SimpleEntityType.PERSON,
    'wikidata:Q5': SimpleEntityType.PERSON,
    'foaf:Person': SimpleEntityType.PERSON,
    'dbo:Person': SimpleEntityType.PERSON,

    'wikidata:Q1656682': SimpleEntityType.EVENT,
    'dul:Event': SimpleEntityType.EVENT,
    'schema:Event': SimpleEntityType.EVENT,
    'dbo:Event': SimpleEntityType.EVENT,

    'dbo:Software': SimpleEntityType.PRODUCT,
    'wikidata:Q7397': SimpleEntityType.PRODUCT,
};

const TYPES_NAME_MAP: PlainObject<string[]> = Object.keys(TYPES_MAP)
    .reduce<PlainObject<string[]>>((map, name) => {
        const type = TYPES_MAP[name];
        map[type] = map[type] || [];
        map[type].push(name);
        return map;
    }, {});

// const TypesKeys = Object.keys(TYPES_MAP);

export function getEntityType(wikiEntity: WikiEntity): SimpleEntityType {
    if (!wikiEntity.types) {
        return null;
    }

    // trying to fix confusion between Org and Person
    if (containsType(wikiEntity.types, SimpleEntityType.ORG) && containsType(wikiEntity.types, SimpleEntityType.PERSON)) {
        return SimpleEntityType.ORG;
    }

    for (var i = 0; i < wikiEntity.types.length; i++) {
        if (TYPES_MAP[wikiEntity.types[i]]) {
            return TYPES_MAP[wikiEntity.types[i]];
        }
    }

}

function containsType(types: string[], type: SimpleEntityType) {
    for (const typeName of types) {
        if (~TYPES_NAME_MAP[type].indexOf(typeName)) {
            return true;
        }
    }

    return false;
}
