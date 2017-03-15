
import { _, Promise, isWikidataId } from '../utils';
import { WikidataEntity, WikidataEntities, WikidataPropertyValue, IIndexType } from './types';
import { getManyEntities, GetEntitiesParamsType } from './api';
import { simplifyEntity } from './simplify_entity';

export * from './types';
export { GetEntitiesParamsType };

export type OptionClaimsType = 'none' | 'all' | 'item' | 'property';

export interface IEntitiesOptions {
    claims?: OptionClaimsType
}

export function getEntities(params: GetEntitiesParamsType, options: IEntitiesOptions = {})
    : Promise<WikidataEntities> {

    options.claims = options.claims || 'all';
    const lang = params.language || 'en';

    return getManyEntities(params)
        .then(function (entities) {
            const ids = Object.keys(entities);
            ids.forEach(id => { entities[id] = simplifyEntity(lang, entities[id]) });

            const tasks = [];
            if (~['all', 'property'].indexOf(options.claims)) {
                tasks.push(findEntitiesProperties(entities, lang));
            }
            if (~['all', 'item'].indexOf(options.claims)) {
                tasks.push(Promise.each(ids, function (id) {
                    return findEntityClaims(entities[id], lang);
                }));
            }

            return Promise.all(tasks).then(() => entities);
        });
}

function findEntitiesProperties(entities: WikidataEntities, lang: string): Promise<any> {
    let ids = [];
    const paths: IIndexType<{ pid: string, value: WikidataPropertyValue, index: number }[]> = {};// id=[key:position]
    const entitiesIds = Object.keys(entities);
    entitiesIds.forEach(entityId => {
        const entity = entities[entityId];
        if (entity.claims) {
            ids = ids.concat(Object.keys(entity.claims));
        }
    });

    if (!ids.length) {
        return Promise.resolve();
    }

    ids = _.uniq(ids);

    console.log(ids);

    return getEntities({
        ids: ids.join('|'),
        language: lang,
        props: 'labels|descriptions|datatype'
    }, { claims: 'none' }).then(function (properties) {
        Object.keys(properties).forEach(propertyId => {
            entitiesIds.forEach(entityId => {
                const entity = entities[entityId];
                if (entity.claims && entity.claims[propertyId]) {
                    if (properties[propertyId].label) {
                        entity.claims[propertyId].label = properties[propertyId].label;
                    }
                    if (properties[propertyId].description) {
                        entity.claims[propertyId].description = properties[propertyId].description;
                    }
                }
            });
        });
        return null;
    });
}

function findEntityClaims(entity: WikidataEntity, lang: string): Promise<WikidataEntity> {
    const claims = entity.claims;

    if (!claims) {
        return Promise.resolve(entity);
    }

    const ids = [];
    const paths: IIndexType<{ pid: string, value: WikidataPropertyValue, index: number }[]> = {};// id=[key:position]
    Object.keys(claims).forEach(property => {
        claims[property].values.forEach((propertyValue, index) => {
            if (propertyValue.datatype === 'wikibase-item') {
                const id = propertyValue.value;
                paths[id] = paths[id] || [];
                paths[id].push({ pid: property, value: propertyValue, index });
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
        language: lang,
        props: 'labels|descriptions|datatype'
    };


    return getEntities(params, { claims: 'none' }).then(entities => {
        Object.keys(entities).forEach(id => {
            const item = entities[id];
            const pa = paths[item.id];
            // console.log('pa', pa);
            pa.forEach(pai => {
                const val = claims[pai.pid].values[pai.index];
                if (item.label) {
                    val.label = item.label;
                }
                if (item.description) {
                    val.description = item.description;
                }
            });
        });
        return entity;
    });
}
