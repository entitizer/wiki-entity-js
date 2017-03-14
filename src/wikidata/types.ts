
export type IIndexType<T> = {
    [index: string]: T
}

export type WikidataEntityTypeType = 'item' | 'property';

export interface WikidataBaseEntity {
    pageid?: number;
    lastrevid?: number;
    modified?: string;
    type: WikidataEntityTypeType;
    id: string;
}

export type WikidataEntityQualifierType = {
    value: string | number | any;
}

export type WikidataEntityClaimType = {
    value: string | number | any;
    qualifiers?: IIndexType<WikidataEntityQualifierType[]>;
}

export type WikidataEntityClaimsType = IIndexType<WikidataEntityClaimType[]>;

export interface WikidataEntity extends WikidataBaseEntity {
    labels?: IIndexType<string>;
    descriptions?: IIndexType<string>;
    aliases?: IIndexType<string[]>;
    claims?: WikidataEntityClaimsType;
    sitelinks?: IIndexType<string>;
}

export type WikidataEntityCollection = IIndexType<WikidataEntity>;