
import { WikiEntity, WikiEntities, WikiEntitiesParams } from './types';
import { getEntities as getWikidataEntities } from './wikidata';
import { Api as WikipediaApi } from './wikipedia/api';
import { isValidWikiId } from './utils';
import { getEntityTypesByName } from './wikidata/get_entity_types';

export { simplifyEntity } from './wikidata/simplify_entity';
export { WikipediaApi }
export * from './simpleEntity';

export * from './types';

export function getEntities(params: WikiEntitiesParams): Promise<WikiEntity[]> {
    const lang = params.language || 'en';

    return getWikidataEntities(params)
        .then(function (wikiDataEntities) {
            const entities: WikiEntities = wikiDataEntities;

            const ids = Object.keys(entities).filter(id => isValidWikiId(id));

            if (ids.length === 0) {
                return entities;
            }

            const tasks: any[] = [];

            const wikiApi = new WikipediaApi();
            let callWikiApi = false;

            if (params.extract) {
                callWikiApi = true;
                wikiApi.extract(params.extract);
            }
            if (params.redirects) {
                callWikiApi = true;
                wikiApi.redirects();
            }
            if (params.categories) {
                callWikiApi = true;
                wikiApi.categories();
            }

            if (callWikiApi && entities[ids[0]].sitelinks) {
                const listEntities = ids.map(id => entities[id]);
                const titleIds = ids.reduce((prev: any, id) => {
                    if (entities[id].sitelinks[lang]) {
                        prev[entities[id].sitelinks[lang]] = id;
                    }
                    return prev;
                }, {});
                tasks.push(wikiApi.query(lang, { titles: ids.map(id => entities[id].sitelinks[lang]).filter(item => !!item).join('|') })
                    .then(apiResults => apiResults.forEach(result => {
                        const entity = entities[titleIds[result.title]];
                        if (params.extract) {
                            entity.extract = result.extract;
                        }
                        if (params.redirects) {
                            entity.redirects = result.redirects;
                        }
                        if (params.categories) {
                            entity.categories = result.categories;
                        }
                    })));
            }

            if (params.types === true || Array.isArray(params.types)) {
                const prefixes: string[] = Array.isArray(params.types) ? params.types : null;
                ids.forEach(id => {
                    if (entities[id].sitelinks) {
                        // console.log(entities[id].label,entities[id].sitelinks)
                        const enName = entities[id].sitelinks['en'];
                        if (enName) {
                            tasks.push(getEntityTypesByName(enName, prefixes).then(types => { entities[id].types = types; }));
                        }
                    }
                })
            }

            return Promise.all(tasks).then(() => entities);

        })
        .then(function (resultEntities) {
            return Object.keys(resultEntities).map(id => resultEntities[id]);
        });
}
