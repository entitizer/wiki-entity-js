

import { simplifyClaims } from './simplify_claims';
import { WikidataEntity } from '../types';

export type SimplifyEntityOptionsType = {
    labels?: boolean;
    descriptions?: boolean;
    aliases?: boolean;
    sitelinks?: boolean;
    claims?: boolean;
}

export function simplifyEntity(lang: string, data: any, options: SimplifyEntityOptionsType = {}): WikidataEntity {

    const entity: WikidataEntity = { id: data.id };

    if (data.pageid) {
        entity.pageid = data.pageid;
    }

    if (options.labels !== false && data.labels) {
        entity.label = simplifyLabels(data.labels)[lang];
    }

    if (options.descriptions !== false && data.descriptions) {
        entity.description = simplifyDescriptions(data.descriptions)[lang];
        if (!entity.description) {
            delete entity.description;
        }
    }

    if (options.aliases !== false && data.aliases) {
        entity.aliases = simplifyAliases(data.aliases)[lang];
        if (!entity.aliases) {
            delete entity.aliases;
        }
    }

    if (options.sitelinks !== false && data.sitelinks) {
        entity.sitelinks = simplifySitelinks(data.sitelinks);
    }

    if (options.claims !== false && data.claims) {
        entity.claims = simplifyClaims(data.claims);
    }

    return entity;
}

export function simplifyAliases(data: any): { [index: string]: string[] } {
    return getManyLangValue(data);
}

export function simplifyDescriptions(data: any): { [index: string]: string } {
    return getLangValue(data);
}

export function simplifyLabels(data: any): { [index: string]: string } {
    return getLangValue(data);
}

export function simplifySitelinks(data: any): { [index: string]: string } {
    if (data) {
        const result = {};

        Object.keys(data).forEach(site => { result[site.replace(/wiki$/, '')] = data[site].title; });

        return result;
    }
    return null;
}

function getLangValue(data: any): { [index: string]: string } {
    if (data) {
        const result = {};

        Object.keys(data).forEach(lang => { result[lang] = data[lang].value; });

        return result;
    }
    return null;
}

function getManyLangValue(data: any): { [index: string]: string[] } {
    if (data) {
        const result = {};

        Object.keys(data).forEach(lang => { result[lang] = data[lang].map(item => item.value); });

        return result;
    }
    return null;
}
