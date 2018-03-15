
import { PlainObject } from '../utils';
import { WikiEntity } from '../types';
import { SimpleEntityType, SIMPLE_ENTITY_TYPES } from './simpleEntity';

export function getEntityType(wikiEntity: WikiEntity): SimpleEntityType {
    if (!wikiEntity.claims) {
        return null;
    }

    const type = getTypeByProp(wikiEntity, 'P31');
    if (type) {
        return type;
    }

    // return getTypeByProp(wikiEntity, 'P279');
}


function getTypeByProp(wikiEntity: WikiEntity, prop: string): SimpleEntityType {
    const instanceOf = wikiEntity.claims[prop];

    if (!instanceOf) {
        return null;
    }

    const ENTITY_TYPES: PlainObject<string[]> = require('../../data/entity_types.json');

    const types = SIMPLE_ENTITY_TYPES;
    for (let i = 0; i < types.length; i++) {
        const type = types[i];
        for (let j = 0; j < instanceOf.values.length; j++) {
            const value = instanceOf.values[j].value;
            if (~ENTITY_TYPES[type].indexOf(value)) {
                return <SimpleEntityType>type;
            }
        }
    }

    return null;
}
