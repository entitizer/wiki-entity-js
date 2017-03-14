
import { WikidataEntity, IIndexType } from './wikidata/types';

export interface WikiEntity extends WikidataEntity {
    extracts?: IIndexType<string>
}