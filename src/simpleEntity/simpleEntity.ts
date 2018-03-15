export enum SimpleEntityType {
    EVENT = 'E',
    ORG = 'O',
    PERSON = 'H',
    PLACE = 'P',
    PRODUCT = 'R',
}

export const SIMPLE_ENTITY_TYPES = [
    SimpleEntityType.EVENT,
    SimpleEntityType.PERSON,
    SimpleEntityType.PLACE,
    SimpleEntityType.ORG,
    SimpleEntityType.PRODUCT
]

export type SimpleEntityData = { [prop: string]: string[] }

export type SimpleEntity = {
    lang?: string
    wikiDataId?: string
    name?: string
    abbr?: string
    description?: string
    about?: string
    wikiPageId?: number
    wikiPageTitle?: string
    type?: SimpleEntityType
    types?: string[]
    countryCode?: string
    data?: SimpleEntityData
    categories?: string[]
}
