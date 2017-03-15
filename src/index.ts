
import { _, Promise } from './utils';
import { WikiEntity, WikiEntities, IIndexType, WikidataEntities, WikiEntitiesParams } from './types';
import { getEntities as getWikidataEntities } from './wikidata';
import { getExtracts } from './wikipedia/api';

export { WikiEntities, WikiEntitiesParams }

export function getEntities(params: WikiEntitiesParams): Promise<WikiEntities> {
    const lang = params.language || 'en';

    return getWikidataEntities(params)
        .then(function (entities) {
            // console.log('entities', entities);
            const ids = Object.keys(entities);
            if (ids.length === 0 || !params.extract) {
                return entities;
            }

            // return entities;

            const titles = getEntitiesTitles(lang, entities);
            // console.log('titles', titles, lang);
            const stringTitles = _.map(titles, 'title').join('|');
            return getExtracts({ lang: lang, titles: stringTitles, sentences: params.extract })
                .then(function (extracts) {
                    extracts.forEach(item => {
                        const it: IdTitleType = _.find(titles, { title: item.title });
                        if (it) {
                            _.set(entities, [it.id, 'extract'].join('.'), item.extract);
                        }
                    });
                }).then(() => entities);
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
