'use strict';

const request = require('request');

import { _, Bluebird } from './utils';

export default function <T>(options: any): Bluebird<T> {
	options = _.defaults(options, {
		method: 'GET',
		json: true,
		encoding: 'utf8',
		headers: {
			'User-Agent': 'entity-finder'
		},
		timeout: 5 * 1000
	});

	if (options.qs) {
		for (var prop in options.qs) {
			if (~[null].indexOf(options.qs[prop])) {
				delete options.qs[prop];
			}
		}
	}

	return new Bluebird<T>(function (resolve, reject) {
		request(options, function (error, response, body) {
			if (error || response.statusCode >= 400) {
				return reject(error || new Error('Invalid statusCode=' + response.statusCode));
			}
			resolve(body);
		});
	});
};
