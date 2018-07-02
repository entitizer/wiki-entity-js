'use strict';

const index = require('../lib');
const assert = require('assert');

describe('types', function () {
    it('should get Chișinău types - Place', function () {
        return index.getEntities({ language: 'en', titles: ['Chișinău'], types: true })
            .then(function (results) {
                assert.equal('Q21197', results[0].id);
                assert.ok(results[0].types);
                assert.equal(true, results[0].types.indexOf('schema:City') > -1);
            });
    });
    it('should get Barack Obama types - Person', function () {
        return index.getEntities({ language: 'en', titles: ['Barack Obama'], types: true })
            .then(function (results) {
                assert.ok(results[0].types);
                assert.equal(true, results[0].types.indexOf('schema:Person') > -1);
            });
    });

    // it('should get Facebook types - Organization', function () {
    //     return index.getEntities({ language: 'en', ids: ['Q380'], types: true })
    //         .then(function (results) {
    //             console.log(results[0].types);
    //             assert.equal(true, results[0].types.indexOf('schema:Organization') > -1);
    //         });
    // });

    it('should get Eurovision types - Event', function () {
        return index.getEntities({ language: 'en', titles: ['Eurovision Song Contest'], types: true })
            .then(function (results) {
                assert.ok(results[0].types);
                // assert.equal(true, results[0].types.indexOf('schema:Event') > -1);
            });
    });
    it('should identify fiction: Mickey Mouse', function () {
        return index.getEntities({ language: 'ro', titles: ['Mickey Mouse'], types: true })
            .then(function (results) {
                assert.ok(results[0].types);
                assert.equal(true, results[0].types.indexOf('dbo:FictionalCharacter') > -1);
            });
    });
    it('should identify: Cabernet Sauvignon', function () {
        return index.getEntities({ language: 'ro', titles: ['Cabernet Sauvignon'], types: true })
            .then(function (results) {
                assert.ok(results[0].types);
                // assert.equal(true, results[0].types.indexOf('schema:Event') > -1);
            });
    });
    it('work: Alice în Țara Minunilorn', function () {
        return index.getEntities({ language: 'ro', titles: ['Alice în Țara Minunilor'], types: true })
            .then(function (results) {
                assert.ok(results[0].types);
                // console.log(results[0]);
                assert.equal(true, results[0].types.indexOf('dbo:Book') > -1);
            });
    });
    it('work: The New York Times', function () {
        return index.getEntities({ language: 'ro', titles: ['The New York Times'], types: true })
            .then(function (results) {
                assert.ok(results[0].types);
                // console.log(results[0]);
                assert.equal(true, results[0].types.indexOf('dbo:Newspaper') > -1);
            });
    });
    // it('product: MacBook Air', function () {
    //     return index.getEntities({ language: 'ro', titles: 'MacBook Air', props: 'info|labels|descriptions', types: true })
    //         .then(function (results) {
    //             console.log(results[0]);
    //             // assert.equal(true, results[0].types.indexOf('dbo:Newspaper') > -1);
    //         });
    // });
});
