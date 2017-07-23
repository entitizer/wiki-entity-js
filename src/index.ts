
import { _, Bluebird } from './utils';
import { WikiEntity, WikiEntities, IIndexType, WikidataEntities, WikiEntitiesParams } from './types';
import { getEntities as getWikidataEntities, getEntityTypes } from './wikidata';
import { Api as WikipediaApi } from './wikipedia/api';

export * from './types';

export function getEntities(params: WikiEntitiesParams): Bluebird<WikiEntity[]> {
    const lang = params.language || 'en';

    return getWikidataEntities(params)
        .then(function (wikiDataEntities) {
            const entities: WikiEntities = wikiDataEntities;
            // console.log('entities', entities);
            const ids = Object.keys(entities);
            if (ids.length === 0) {
                return entities;
            }

            // console.log('ids', ids);

            const tasks = [];

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
                const titleIds = ids.reduce((prev, id) => {
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
                tasks.push(Bluebird.map(ids, id => {
                    return getEntityTypes(id, prefixes)
                        .then(types => {
                            entities[id].types = types;
                        });
                }));
            }

            return Bluebird.all(tasks).then(() => entities);

        }).then(function (resultEntities) {
            return Object.keys(resultEntities).map(id => resultEntities[id]);
        });
}

type IdTitleType = {
    id: string,
    title: string
}

function getEntitiesTitles(lang: string, entities: WikidataEntities): IdTitleType[] {
    const titles: IdTitleType[] = [];

    Object.keys(entities).forEach(id => {
        const entity = entities[id];
        let added = false;
        if (entity.sitelinks) {
            const title = entity.sitelinks[lang];
            if (title) {
                added = true;
                titles.push({ title: title, id: entity.id });
            }
        }
        if (!added && entity.label) {
            titles.push({ id: entity.id, title: entity.label });
        }
    });

    return titles;
}
