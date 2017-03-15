'use strict';

const index = require('../lib');
const assert = require('assert');

describe('entities', function () {
    it('getEntities props:labels|descriptions', function () {
        return index.getEntities({ language: 'en', titles: 'Chișinău|Enichioi', props: 'labels|descriptions' })
            .then(function (result) {
                assert.ok(result.Q21197);
                assert.ok(result.Q2438184);
                // console.log(JSON.stringify(result));
            });
    });
});
