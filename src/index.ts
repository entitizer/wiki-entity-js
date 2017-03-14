
import { _, Promise } from './utils';
import { WikiEntity } from './types';
import { getEntities as getWikidataEntities, GetEntitiesParamsType, IEntitiesOptions as IWikidataEntitiesOptions, IIndexType, WikidataEntityCollection } from './wikidata';
import { getExtracts } from './wikipedia/api';

export interface IEntitiesOptions extends IWikidataEntitiesOptions {
    extracts?: boolean
}

export function getEntities(params: GetEntitiesParamsType, options: IEntitiesOptions = {}): Promise<WikidataEntityCollection> {
    return getWikidataEntities(params, options)
        .then(function (entities) {
            // console.log('entities', entities);
            const ids = Object.keys(entities);
            if (ids.length === 0 || options.extracts === false) {
                return entities;
            }

            const langTitlesMap = getEntitiesTitlesBylangs(getLanguages(params.languages), entities);

            return Promise.map(Object.keys(langTitlesMap), function (lang) {
                const titles = _.map(langTitlesMap[lang], 'title');
                // console.log('titles', titles, lang);
                return getExtracts({ lang: lang, titles: titles.join('|') })
                    .then(function (extracts) {
                        extracts.forEach(item => {
                            const it: IdTitleType = _.find(langTitlesMap[lang], { title: item.title });
                            if (it) {
                                _.set(entities, [it.id, 'extracts', lang].join('.'), item.extract);
                            }
                        });
                    });
            }).then(() => entities);
        });
}

type IdTitleType = {
    id: string,
    title: string
}

function getEntitiesTitlesBylangs(langs: string[], entities: WikidataEntityCollection): IIndexType<IdTitleType[]> {
    const titles: IIndexType<IdTitleType[]> = {};

    Object.keys(entities).forEach(id => {
        const entity = entities[id];
        if (entity.sitelinks) {
            for (var i = 0; i < langs.length; i++) {
                const lang = langs[i];
                const title = entity.sitelinks[lang];
                if (title) {
                    titles[lang] = titles[lang] || [];
                    titles[lang].push({ title: title, id: entity.id });
                }
            }
        }
    });

    return titles;
}

function getLanguages(languages?: string): string[] {
    if (!languages || languages.length === 0) {
        return ['en'];
    }
    return languages.split('|');
}
