'use strict';

const lib = require('../lib');

const fromWikiEntity = lib.convertToSimpleEntity;
const Entity = lib.SimpleEntity;
const wikiEntity = lib;
const assert = require('assert');
const getEntityCC2 = require('../lib/simpleEntity/getEntityCountry').getEntityCountryCode;

describe('SimpleEntity', function () {
    it('getEntityCountry', function () {
        const lang = 'ro';
        return wikiEntity.getEntities({ language: lang, ids: 'Q12729770', claims: 'item' })
            .then(function (entities) {
                assert.equal(1, entities.length);
                const cc2 = getEntityCC2(entities[0]);
                assert.equal(cc2, 'MD');
            });
    });
    it('fromWikiEntity en:simple', function () {
        const lang = 'en';
        return wikiEntity.getEntities({ language: lang, ids: 'Q18548924', claims: 'none', types: true })
            .then(function (entities) {
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                assert.equal('Adrian Ursu', entity.name);
                assert.equal('Q18548924', entity.wikiDataId);
                assert.equal('H', entity.type);

                // console.log(entity.toJSON());
            });
    });
    it('fromWikiEntity ro:simple', function () {
        const lang = 'ro';
        return wikiEntity.getEntities({ language: lang, ids: 'Q18548924', claims: 'none', types: true })
            .then(function (entities) {
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                assert.equal('Adrian Ursu', entity.name);
                assert.equal('Q18548924', entity.wikiDataId);
                assert.equal('Adrian Ursu (cântăreț)', entity.wikiPageTitle);
                assert.equal('H', entity.type);
                assert.equal(true, entity.rank > 0);

                // console.log(entity.name, 'rank', entity.rank);

                // console.log(entity.toJSON());
            });
    });
    it('fromWikiEntity Albert Einstein: birth, death dates', function () {
        const lang = 'en';
        return wikiEntity.getEntities({ language: lang, ids: 'Q937', claims: 'all', types: true })
            .then(function (entities) {
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                assert.equal('Albert Einstein', entity.name);
                assert.equal('Q937', entity.wikiDataId);
                assert.equal('H', entity.type);
                assert.equal('Q5', entity.data.P31[0]);
                assert.equal('1879-03-14', entity.data.P569[0]);
                assert.equal('CH', entity.countryCode);

                // console.log(entity.name, 'rank', entity.rank);

                // console.log(entity.toJSON());
            });
    });
    it('fromWikiEntity Ștefan cel Mare (unknown dates)', function () {
        const lang = 'ro';
        return wikiEntity.getEntities({ language: lang, titles: 'Ștefan cel Mare', claims: 'item', types: true })
            .then(function (entities) {
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                assert.equal('Ștefan cel Mare', entity.name);
                assert.equal('H', entity.type);
                // human
                assert.equal('Q5', entity.data.P31[0]);
                // birth date
                assert.equal('1424', entity.data.P569[0]);
                // console.log(entity.countryCode)
                // has english wiki title
                // assert.ok(!entity.countryCode);

                // console.log(entity.name, 'rank', entity.rank);

                // console.log(entity.toJSON());
            });
    });
    it('fromWikiEntity IPhone 5 Product', function () {
        const lang = 'en';
        return wikiEntity.getEntities({ language: lang, ids: 'Q61504', claims: 'all', types: true })
            .then(function (entities) {
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                assert.equal('iPhone 5', entity.name);
                // product
                assert.equal('R', entity.type);
                assert.ok(!entity.countryCode);

                // console.log(entity.name, 'rank', entity.rank);

                // console.log(entity.toJSON());
            });
    });
    it('fromWikiEntity Chisinau Location data', function () {
        const lang = 'en';
        return wikiEntity.getEntities({ language: lang, ids: 'Q21197', claims: 'all', types: true })
            .then(function (entities) {
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                assert.equal('Chișinău', entity.name);
                // Location
                assert.equal('P', entity.type);
                assert.equal('MD', entity.countryCode);

                // console.log(entity.name, 'rank', entity.rank);

                // console.log(entity.data);
            });
    });

    it('fromWikiEntity Facebook Organisation data', function () {
        const lang = 'en';
        return wikiEntity.getEntities({ language: lang, ids: 'Q380', claims: 'none', types: true })
            .then(function (entities) {
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                assert.equal('Facebook Inc.', entity.name);
                // Organisation
                assert.equal('O', entity.type);
                assert.equal('US', entity.countryCode);

                // console.log(entity.name, 'rank', entity.rank);

                // console.log(entity.toJSON());
            });
    });

    it('fromWikiEntity Euro 2016 Event data', function () {
        const lang = 'en';
        return wikiEntity.getEntities({ language: lang, ids: 'Q189571', claims: 'none', types: true })
            .then(function (entities) {
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                assert.equal('UEFA Euro 2016', entity.name);
                // Event
                assert.equal('E', entity.type);
                assert.equal('FR', entity.countryCode);

                // console.log(entity.name, 'rank', entity.rank);

                // console.log(entity.toJSON());
            });
    });

    it('fromWikiEntity Windows 7 Product data', function () {
        const lang = 'en';
        return wikiEntity.getEntities({ language: lang, ids: 'Q11215', claims: 'none', types: true })
            .then(function (entities) {
                // console.log(entities[0]);
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                assert.equal('Windows 7', entity.name);
                // Product
                assert.equal('R', entity.type);
                assert.ok(!entity.countryCode);

                // console.log(entity.name, 'rank', entity.rank);

                // console.log(entity.toJSON());
            });
    });

    it('Scotland & categories', function () {
        const lang = 'en';
        return wikiEntity.getEntities({ language: lang, ids: 'Q22', claims: 'node', types: true, categories: true })
            .then(function (entities) {
                // console.log(entities[0].categories);
                assert.equal(1, entities.length);
                const entity = fromWikiEntity(entities[0], lang);
                console.log(entity)
                assert.equal('Scotland', entity.name);
                assert.equal('P', entity.type);
                assert.ok(entities[0].categories.length);
            });
    });
});