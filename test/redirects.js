'use strict';

const index = require('../lib');
const assert = require('assert');

describe('redirects', function () {
    it('should get Chișinău redirects', function () {
        return index.getEntities({ language: 'en', titles: 'Chișinău', props: 'info|labels|descriptions|sitelinks', redirects: true })
            .then(function (results) {
                assert.equal('Q21197', results[0].id);
                assert.ok(results[0].redirects);
                assert.ok(results[0].redirects.length);
                // console.log(results[0].redirects);
            });
    });
    it('should get Barack Obama redirects', function () {
        return index.getEntities({ language: 'en', titles: 'Barack Obama', props: 'info|labels|descriptions|sitelinks', redirects: true })
            .then(function (results) {
                assert.ok(results[0].redirects);
                assert.ok(results[0].redirects.length);
            });
    });
});
