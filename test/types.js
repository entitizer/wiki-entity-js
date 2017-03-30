'use strict';

const index = require('../lib');
const assert = require('assert');

describe('types', function () {
    it('should get Chișinău types - Place', function () {
        return index.getEntities({ language: 'en', titles: 'Chișinău', props: 'info|labels|descriptions', types: true })
            .then(function (results) {
                assert.equal('Q21197', results[0].id);
                assert.ok(results[0].types);
                assert.equal(true, results[0].types.indexOf('schema:City') > -1);
            });
    });
    it('should get Barack Obama types - Person', function () {
        return index.getEntities({ language: 'en', titles: 'Barack Obama', props: 'info|labels|descriptions', types: true })
            .then(function (results) {
                assert.ok(results[0].types);
                assert.equal(true, results[0].types.indexOf('schema:Person') > -1);
            });
    });

    it('should get Facebook types - Organization', function () {
        return index.getEntities({ language: 'en', ids: 'Q380', props: 'info|labels|descriptions', types: true })
            .then(function (results) {
                assert.ok(results[0].types);
                assert.equal(true, results[0].types.indexOf('schema:Organization') > -1);
            });
    });

    it('should get Eurovision types - Event', function () {
        return index.getEntities({ language: 'en', titles: 'Eurovision Song Contest', props: 'info|labels|descriptions', types: true })
            .then(function (results) {
                assert.ok(results[0].types);
                // console.log(results[0].types);
                assert.equal(true, results[0].types.indexOf('schema:Event') > -1);
            });
    });
});
