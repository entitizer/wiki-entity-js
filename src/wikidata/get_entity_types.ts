
import { _, Promise } from '../utils';
import request from '../request';

const PREFIXES_MAP = {
    'http://www.ontologydesignpatterns.org/ont/dul/DUL.owl#': 'dul',
    'http://dbpedia.org/ontology/': 'dbo',
    'http://www.w3.org/2002/07/owl#': 'owl',
    'http://www.wikidata.org/entity/': 'wikidata',
    'http://schema.org/': 'schema',
    'http://xmlns.com/foaf/0.1/': 'foaf',
    'http://www.w3.org/2003/01/geo/wgs84_pos#': 'geo'
};

const PREFIXES = Object.keys(PREFIXES_MAP).map(key => PREFIXES_MAP[key]);
const PREFIXES_REG = new RegExp('^(' + Object.keys(PREFIXES_MAP).join('|') + ')');

export function getEntityTypes(id: string, prefixes?: string[]): Promise<string[]> {
    if (!prefixes || !prefixes.length) {
        prefixes = PREFIXES;
    }
    
    const resource = `http://wikidata.dbpedia.org/resource/${id}`;

    return request<any>({ url: `http://wikidata.dbpedia.org/data/${id}.json` })
        .then(data => {
            if (!data || !data[resource]) {
                return [];
            }
            
            const types: { type: string, value: string }[] = data[resource]['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'] || [];
            if (types.length === 0) {
                return types;
            }

            return types.filter(item => PREFIXES_REG.test(item.value))
                .map(item => {
                    const key = PREFIXES_REG.exec(item.value)[1];
                    return PREFIXES_MAP[key] + ':' + item.value.substr(key.length);
                });
        });
}
