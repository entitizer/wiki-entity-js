
export type IIndexType<T> = {
    [index: string]: T
}

export interface WikidataPropertyValue {
    datatype: string;
    value: any;
    pageid?: number;
    value_string?: string;
    label?: string;
    description?: string;
}

export interface WikidataBaseEntity {
    id: string;
    label?: string;
    description?: string;
}

export interface WikidataProperty extends WikidataBaseEntity {
    values: WikidataPropertyValue[];
}

export type WikidataEntityClaims = IIndexType<WikidataProperty>;

export interface WikidataEntity extends WikidataBaseEntity {
    pageid?: number;
    aliases?: string[];
    sitelinks?: IIndexType<string>;
    claims?: WikidataEntityClaims;
}

export type WikidataEntities = IIndexType<WikidataEntity>;

export interface WikiEntity extends WikidataEntity {
    extract?: string;
    types?: string[];
    redirects?: string[];
    categories?: string[];
}

export type WikiEntities = IIndexType<WikiEntity>;

export type ParamClaimsType = 'none' | 'all' | 'item' | 'property';
export interface WikidataEntitiesParams {
    ids?: string,
    titles?: string,
    props?: string,
    language?: string,
    // sites?: string[] | string,
    // sitefilter?: string[] | string,
    redirect?: string,
    claims?: ParamClaimsType
}

export interface WikiEntitiesParams extends WikidataEntitiesParams {
    /**
     * Sentences count. 0 - no extract
     */
    extract?: number
    types?: boolean | string[]
    redirects?: boolean
    categories?: boolean
}
