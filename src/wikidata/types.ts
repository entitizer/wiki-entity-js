
export type IIndexType<T> = {
    [index: string]: T
}

export type WikidataEntityTypeType = 'item' | 'property';

export interface WikidataPropertyValue {
    datatype: string;
    value: any;
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
    aliases?: string[];
    sitelinks?: IIndexType<string>;
    claims?: WikidataEntityClaims;
}

export type WikidataEntities = IIndexType<WikidataEntity>;