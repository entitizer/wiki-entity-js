"use strict";

const index = require("../lib");
const assert = require("assert");

describe("entities", function () {
  it("should order results by input titles", function () {
    return index
      .getEntities({
        languages: ["en", "ru", "de", "fr", "it"],
        titles: ["Chișinău", "Cantemir, Moldova"],
        types: true
      })
      .then(function (results) {
        assert.equal("Q21197", results[0].id);
        assert.equal("Q2250055", results[1].id);
        assert.ok(results[0].types);
        assert.equal(true, results[0].types.indexOf("schema:City") > -1);
        assert.equal(true, results[1].types.indexOf("schema:Place") > -1);
        assert.ok(Object.keys(results[0].labels).length > 2);
      });
  });

  it("should order results by input ids", function () {
    return index
      .getEntities({
        ids: ["Q2438184", "Q21197"],
        props: ["labels", "descriptions"]
      })
      .then(function (results) {
        assert.equal("Q2438184", results[0].id);
        assert.equal("Q21197", results[1].id);
      });
  });

  it("should parse claim time type", function () {
    return index.getEntities({ ids: ["Q218134"] }).then(function (results) {
      assert.equal(results[0].claims.P570.values[0].value_string, "1504-07-02");
      // console.log(results[0].claims.P569.values);
      // assert.equal('Q2438184', results[0].id);
      // assert.equal('Q21197', results[1].id);
    });
  });

  it("should not throw any error", function () {
    return index
      .getEntities({ language: "ro", titles: ["Italia"], types: true })
      .then(function (results) {
        assert.equal("Q38", results[0].id);
      });
  });

  it(`Joseph_"Chip"_Yablonski`, function () {
    return index
      .getEntities({ language: "en", titles: ["Joseph_\"Chip\"_Yablonski"], types: true })
      .then(function (results) {
        assert.equal("Q6280729", results[0].id);
      });
  });

  it("missing id", function () {
    return index
      .getEntities({
        language: "en",
        ids: ["Q7759840"],
        types: false,
        categories: false
      })
      .then(function (results) {
        console.log(results);
        assert.equal(results.length, 0);
      });
  });
});
