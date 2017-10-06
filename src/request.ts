'use strict';

const request = require('request');
const debug = require('debug')('wiki-entity');

export default function <T>(options: any): Promise<T> {
	options = Object.assign({
		method: 'GET',
		json: true,
		encoding: 'utf8',
		headers: {
			'User-Agent': 'entity-finder'
		},
		timeout: 5 * 1000
	}, options);

	if (options.qs) {
		for (var prop in options.qs) {
			if (~[null].indexOf(options.qs[prop])) {
				delete options.qs[prop];
			}
		}
	}

	debug('request ' + (options.uri || options.url), options.qs);

	return new Promise<T>(function (resolve, reject) {
		request(options, function (error: Error, response: any, body: any) {
			if (error || response.statusCode >= 400) {
				return reject(error || new Error('Invalid statusCode=' + response.statusCode));
			}
			resolve(body);
		});
	});
};
