

import { OptionsType as SimplifyClaimsOptionsType, simplifyClaims } from './simplify_claims';
import { WikidataEntity } from './types';
import { _ } from '../utils';

export type SimplifyEntityOptionsType = {
    labels?: boolean;
    descriptions?: boolean;
    aliases?: boolean;
    sitelinks?: boolean;
    claims?: boolean | SimplifyClaimsOptionsType;
}

export function simplifyEntity(entity: WikidataEntity, options: SimplifyEntityOptionsType = {}): WikidataEntity {

    if (options.labels !== false && entity.labels) {
        entity.labels = simplifyLabels(entity.labels);
    }

    if (options.descriptions !== false && entity.descriptions) {
        entity.descriptions = simplifyDescriptions(entity.descriptions);
    }

    if (options.aliases !== false && entity.aliases) {
        entity.aliases = simplifyAliases(entity.aliases);
    }

    if (options.sitelinks !== false && entity.sitelinks) {
        entity.sitelinks = simplifySitelinks(entity.sitelinks);
    }

    if (options.claims !== false && entity.claims) {
        entity.claims = simplifyClaims(entity.claims, options.claims);
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

        Object.keys(data).forEach(lang => { result[lang] = _.map(data[lang], 'value'); });

        return result;
    }
    return null;
}
