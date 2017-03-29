
import { _, Promise } from './utils';
import { WikiEntity, WikiEntities, IIndexType, WikidataEntities, WikiEntitiesParams } from './types';
import { getEntities as getWikidataEntities, getEntityTypes } from './wikidata';
import { getExtracts } from './wikipedia/api';

export * from './types';

export function getEntities(params: WikiEntitiesParams): Promise<WikiEntity[]> {
    const lang = params.language || 'en';

    return getWikidataEntities(params)
        .then(function (wikiDataEntities) {
            const entities: WikiEntities = wikiDataEntities;
            // console.log('entities', entities);
            const ids = Object.keys(entities);
            if (ids.length === 0) {
                return entities;
            }

            const tasks = [];



            if (params.extract) {
                const titles = getEntitiesTitles(lang, entities);
                // console.log('titles', titles, lang);
                const stringTitles = _.map(titles, 'title').join('|');
                tasks.push(getExtracts({ lang: lang, titles: stringTitles, sentences: params.extract })
                    .then(function (extracts) {
                        extracts.forEach(item => {
                            const it: IdTitleType = _.find(titles, { title: item.title });
                            if (it) {
                                _.set(entities, [it.id, 'extract'].join('.'), item.extract);
                            }
                        });
                    }));
            }

            if (params.types === true || Array.isArray(params.types)) {
                const prefixes: string[] = Array.isArray(params.types) ? params.types : null;
                tasks.push(Promise.map(ids, id => {
                    return getEntityTypes(id, prefixes)
                        .then(types => {
                            entities[id].types = types;
                        });
                }));
            }

            return Promise.all(tasks).then(() => entities);

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
