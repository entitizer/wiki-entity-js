'use strict';

const index = require('../lib');
const assert = require('assert');

describe('entities', function () {
    it('should work', function () {
        return index.getEntities({ languages: 'en|ro', titles: 'Vlad Filat' })
            .then(function (result) {
                // console.log(JSON.stringify(result));
            });
    });
});
