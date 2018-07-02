
import request from '../request';
import { WikidataEntity, WikidataEntities, WikidataEntitiesParams, WikidataPropsParam } from '../types';
import { isValidWikiId } from '../utils';

const API_URL = 'https://www.wikidata.org/w/api.php';

export function getEntities(params: WikidataEntitiesParams): Promise<WikidataEntities> {

    const qs = {
        action: 'wbgetentities',
        ids: params.ids && params.ids.join('|'),
        titles: params.titles && params.titles.join('|'),
        props: (params.props || [
            WikidataPropsParam.info,
            WikidataPropsParam.sitelinks,
            WikidataPropsParam.aliases,
            WikidataPropsParam.labels,
            WikidataPropsParam.descriptions,
            WikidataPropsParam.claims,
            WikidataPropsParam.datatype
        ]).join('|'),
        languages: getStringArrayParam(params.language, 'en'),
        // sitefilter: getStringArrayParam(params.sitefilter),
        redirects: params.redirect || 'yes',
        format: 'json',
        sites: ''
    };

    if (params.titles) {
        qs.sites = qs.languages.split('|')[0] + 'wiki';
    } else {
        delete qs.sites;
    }

    return request<any>({ qs: qs, url: API_URL, timeout: 10 * 1000 })
        .then(data => {
            if (hasError(data)) {
                return Promise.reject(getError(data));
            }
            const entities = data && data.entities || {};
            for (let id of Object.keys(entities)) {
                if (!isValidWikiId(id)) {
                    entities[id] = null;
                }
            }
            return entities;
        });
}

export function getManyEntities(params: WikidataEntitiesParams): Promise<WikidataEntities> {
    try {
        validateParams(params);
    } catch (e) {
        return Promise.reject(e);
    }
    const keyName = (!!params.ids) ? 'ids' : 'titles';
    const keyValues = params[keyName];

    const max = 50;

    const countParts = keyValues.length / max + 1;
    const parts: Promise<WikidataEntities>[] = [];

    // i < 4 (max 200 items)
    for (var i = 0; i < countParts && i < 4; i++) {
        const partParams: WikidataEntitiesParams = Object.assign({}, params);
        partParams[keyName] = keyValues.slice(i * max, (i + 1) * max);
        if (partParams[keyName].length > 0) {
            parts.push(getEntities(partParams));
        }
    }

    return Promise.all(parts).then(function (results) {
        if (results.length === 0) {
            return null;
        }

        if (results.length > 1) {
            for (var i = 1; i < results.length; i++) {
                Object.assign(results[0], results[i]);
            }
        }

        return results[0];
    });
}

export function validateParams(params: WikidataEntitiesParams) {
    if (!params.ids && !params.titles) {
        throw new Error('Invalid params: `ids` or `titles` are required');
    }
}

function getError(data: any): Error {
    return data && data.error && new Error(data.error.info || 'Wikidata Api Error') || new Error('NO error');
}

function hasError(data: any): boolean {
    return !!data.error;
}

function getStringArrayParam(value: string, def: string = null) {
    if (!value || value.length === 0) {
        return def;
    }
    return value;
}
