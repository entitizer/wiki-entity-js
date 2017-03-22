'use strict';

const index = require('../lib');
const assert = require('assert');

describe('entities', function () {
    it('should order results by input titles', function () {
        return index.getEntities({ language: 'en', titles: 'Chișinău|Enichioi', props: 'info|labels|descriptions' })
            .then(function (results) {
                assert.equal('Q21197', results[0].id);
                assert.equal('Q2438184', results[1].id);
            });
    });
    it('should order results by input ids', function () {
        return index.getEntities({ ids: 'Q2438184|Q21197', props: 'labels|descriptions' })
            .then(function (results) {
                assert.equal('Q2438184', results[0].id);
                assert.equal('Q21197', results[1].id);
            });
    });
    it('should parse claim time type', function () {
        return index.getEntities({ ids: 'Q218134' })
            .then(function (results) {
                console.log(results[0].claims.P569.values);
                // assert.equal('Q2438184', results[0].id);
                // assert.equal('Q21197', results[1].id);
            });
    });
});
