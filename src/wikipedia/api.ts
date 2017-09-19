
import { StringPlainObject } from '../utils';
import request from '../request';

const API_URL = 'https://$lang.wikipedia.org/w/api.php';

export type ExtractType = {
    pageid: number,
    title: string,
    extract: string
}

export type ExtractsParamsType = {
    lang: string,
    titles: string,
    sentences?: number
}

export type ApiResult = {
    pageid: number
    title: string
    extract?: string
    categories?: string[]
    redirects?: string[]
}

export class Api {
    constructor(private options: StringPlainObject = { action: 'query', format: 'json' }) {
        this.options.action = this.options.action || 'query';
        this.options.format = 'json';
    }

    query(lang: string, options?: StringPlainObject): Promise<ApiResult[]> {
        if (options) {
            this.options = Object.assign({}, this.options, options);
        }

        // console.log(this.options)

        return request<any>({ qs: this.options, url: API_URL.replace('$lang', lang) })
            .then(data => {
                if (hasError(data)) {
                    return Promise.reject(getError(data));
                }
                // console.log(data);
                if (data && data.query && data.query.pages) {
                    // console.log(JSON.stringify(data));
                    return Promise.resolve(Object.keys(data.query.pages)
                        .map(id => data.query.pages[id])
                        .map(data => {
                            const item: ApiResult = { pageid: data['pageid'], title: data['title'] };

                            if (data['categories']) {
                                item.categories = data['categories'].map(item => item.title);
                            }

                            if (data['redirects']) {
                                item.redirects = data['redirects'].map(item => item.title);
                            }

                            if (data['extract']) {
                                item.extract = data['extract'];
                            }

                            return item;
                        }));
                }
                return Promise.resolve([]);
            });
    }

    redirects() {
        this.options['rdlimit'] = 'max';
        this.addField('prop', 'redirects');
        return this;
    }

    categories() {
        this.addField('prop', 'categories');
        return this;
    }

    extract(sentences: number = 3) {
        this.options['exsentences'] = sentences.toString();
        this.options['explaintext'] = 'true';
        this.addField('prop', 'extracts');
        return this;
    }

    private addField(name: string, value: string) {
        const vals = (this.options[name] || '').split('|').filter(item => !!item);
        vals.push(value);
        this.options[name] = vals.join('|');

        return this;
    }
}

export function getExtracts(params: ExtractsParamsType): Promise<ExtractType[]> {

    const qs = {
        action: 'query',
        titles: getStringArrayParam(params.titles),
        exsentences: params.sentences || 3,
        prop: 'extracts',
        explaintext: true,
        exintro: true,
        exlimit: 'max',
        exsectionformat: 'plain',
        format: 'json'
    };

    // console.log(qs);

    return request<any>({ qs: qs, url: API_URL.replace('$lang', params.lang) })
        .then(data => {
            if (hasError(data)) {
                return Promise.reject(getError(data));
            }
            // console.log(data);
            if (data && data.query && data.query.pages) {
                return Object.keys(data.query.pages).map(id => data.query.pages[id]);
            }
            return Promise.resolve([]);
        });
}

export function getExtract(lang: string, title: string, sentences?: number): Promise<ExtractType> {
    return getExtracts({
        lang: lang,
        titles: title,
        sentences: sentences
    }).then(function (extracts) {
        if (extracts.length) {
            return extracts[0];
        }
        return null;
    });
}

export function getRedirects(lang: string, title: string): Promise<string[]> {
    const qs = {
        action: 'query',
        generator: 'redirects',
        titles: title,
        grdlimit: 'max',
        format: 'json'
    };

    return request<any>({ qs: qs, url: API_URL.replace('$lang', lang) })
        .then(data => {
            if (hasError(data)) {
                return Promise.reject(getError(data));
            }

            if (data && data.query && data.query.pages) {
                return Object.keys(data.query.pages).map(id => data.query.pages[id].title);
            }
            return Promise.resolve([]);
        });
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
