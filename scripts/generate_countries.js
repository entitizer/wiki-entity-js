'use strict';

const debug = require('debug')('script');
const request = require('request');
const Promise = require('bluebird');
const fs = require('fs');
const path = require('path');

function buildResult() {

    return queryCountries().then(items => {
        debug('got items');
        const data = {};
        items.forEach(item => {
            const id = item.item.value.substr(item.item.value.lastIndexOf('/') + 1);
            data[id] = {
                id: id,
                cc2: item.cc2.value,
                cc3: item.cc3.value,
            };
        });
        return data;
    });
}

function saveResult(result) {
    // debug('saving result', result);
    try {
        fs.writeFileSync(path.join(__dirname, '../data/countries.json'), JSON.stringify(result), { encoding: 'utf8' });
    } catch (e) {
        return Promise.reject(e);
    }
    return Promise.resolve();
}

function run() {
    debug('START');
    return buildResult().then(saveResult);
}

run()
    .then(function () {
        console.log('OK');
    })
    .catch(function (error) {
        console.error('error', error);
    });

function queryCountries() {
    return new Promise(function (resolve, reject) {
        request({
            url: 'https://query.wikidata.org/bigdata/namespace/wdq/sparql',
            method: 'GET',
            qs: {
                query: `SELECT DISTINCT ?item ?cc2 ?cc3
WHERE
{
	?item wdt:P31 wd:Q6256 .
	?item wdt:P297 ?cc2 .
	?item wdt:P298 ?cc3 .
}
ORDER BY ?item
limit 1000`
            },
            json: true
        }, function (error, response, json) {
            if (error) {
                return reject(error);
            }
            if (!json.results || !json.results.bindings || !json.results.bindings.length) {
                debug('result is null', json);
                return resolve([]);
            }

            resolve(json.results.bindings);
        });
    });
}