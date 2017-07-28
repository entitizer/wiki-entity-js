'use strict';

const index = require('../lib');
const assert = require('assert');

describe('extracts', function () {
    it('should get Chișinău extract', function () {
        return index.getEntities({ language: 'en', titles: 'Chișinău', props: 'info|labels|descriptions|sitelinks', extract: 3 })
            .then(function (results) {
                assert.equal('Q21197', results[0].id);
                assert.ok(results[0].extract);
            });
    });
});
