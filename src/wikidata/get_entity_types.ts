
import request from '../request';
import { StringPlainObject } from '../types';

const PREFIXES_MAP: StringPlainObject = {
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

    return dbpediaWikidataTypes(id)
        .then((types) => parseTypes(types))
        .then(types => {
            return types.filter(item => PREFIXES_REG.test(item))
                .map(item => {
                    const key = PREFIXES_REG.exec(item)[1];
                    return PREFIXES_MAP[key] + ':' + item.substr(key.length);
                });
        });
}

function parseTypes(types: any[]): string[] {
    return types.map(item => item.type.value);
}

function dbpediaWikidataTypes(id: string): Promise<any[]> {
    const query = `PREFIX dbpedia-wikidata: <http://wikidata.dbpedia.org/resource/>
SELECT ?type
WHERE {
dbpedia-wikidata:${id} rdf:type ?type
}`;
    return request<any>({ url: 'http://wikidata.dbpedia.org/sparql', qs: { query: query } })
        .then(data => data.results && data.results.bindings);
}

function dbpediaTypes(name: string): Promise<any[]> {
    const query = `PREFIX dbr: <http://dbpedia.org/resource/>
SELECT ?type
WHERE {
dbr:${name.replace(/\s+/, ' ')} rdf:type ?type
}`;
    return request<any>({ url: 'http://dbpedia.org/sparql', qs: { query: query } })
        .then(data => data.results && data.results.bindings);
}
