
import { _, Promise, isWikidataId } from '../utils';
import { WikidataEntity, WikidataEntityCollection } from './types';
import { getManyEntities, GetEntitiesParamsType } from './api';
import { simplifyEntity } from './simplify_entity';

export * from './types';
export { GetEntitiesParamsType };

export type OptionClaimsType = 'none' | 'all' | 'item' | 'property';

export interface IEntitiesOptions {
    claims?: OptionClaimsType
}

export function getEntities(params: GetEntitiesParamsType, options: IEntitiesOptions = {})
    : Promise<WikidataEntityCollection> {

    options.claims = options.claims || 'all';

    return getManyEntities(params)
        .then(function (entities) {
            const ids = Object.keys(entities);
            ids.forEach(id => simplifyEntity(entities[id]));
            // console.log('options', options);
            if (options.claims === 'all') {
                return Promise.each(ids, function (id) {
                    return findEntityClaims(entities[id], params);
                }).then(() => entities);
            }
            return entities;
        });
}

function findEntityClaims(entity: WikidataEntity, options?: GetEntitiesParamsType): Promise<WikidataEntity> {
    const claims = entity.claims;

    if (!claims) {
        return Promise.resolve(entity);
    }

    const ids = [];
    const paths = {};// id=[key:position]
    Object.keys(claims).forEach(property => {
        claims[property].forEach((claim, index) => {
            const id = claim.value;
            if (isWikidataId(id)) {
                paths[id] = paths[id] || [];
                paths[id].push({ property, index });
                if (ids.indexOf(id) < 0) {
                    ids.push(id);
                }
            }
        });
    });

    if (ids.length === 0) {
        return Promise.resolve(entity);
    }

    const params: GetEntitiesParamsType = {
        ids: ids.join('|'),
        languages: options && options.languages,
        props: 'labels|descriptions|datatype'
    };


    return getEntities(params, { claims: 'none' }).then(entities => {
        Object.keys(entities).forEach(id => {
            const item = entities[id];
            const pa = paths[item.id];
            // console.log('pa', pa);
            pa.forEach(pai => {
                claims[pai.property][pai.index].value = item;
            });
        });
        return entity;
    });
}
