"use strict";

const index = require("../lib");
const assert = require("assert");

describe("redirects", function () {
  it("should get Chișinău redirects", function () {
    return index
      .getEntities({
        language: "en",
        titles: ["Chișinău"],
        props: ["info", "labels", "descriptions", "sitelinks"],
        redirects: true
      })
      .then(function (results) {
        assert.equal("Q21197", results[0].id);
        assert.ok(results[0].redirects);
        assert.ok(results[0].redirects.length);
      });
  });

  it("should get Barack Obama redirects", function () {
    return index
      .getEntities({
        language: "en",
        titles: ["Barack Obama"],
        props: ["info", "labels", "descriptions", "sitelinks"],
        redirects: true
      })
      .then(function (results) {
        assert.ok(results[0].redirects);
        assert.ok(results[0].redirects.length);
      });
  });

  it("Q104772811 redirectsToId", function () {
    return index
      .getEntities({
        language: "en",
        ids: ["Q104772811"],
        props: ["info", "labels", "descriptions", "sitelinks"],
        redirects: true
      })
      .then(function (results) {
        assert.equal(results[0].redirectsToId, "Q104794561");
      });
  });

  it("Kara Tointon pageid", function () {
    return index
      .getEntities({
        language: "en",
        titles: ["Kara Tointon"],
        redirects: true
      })
      .then(function (results) {
        assert.equal(results[0].pageid, 3198752);
      });
  });

  it("redirect Brashov to Brașov", function () {
    return index
      .getEntities({
        language: "ro",
        titles: ["Brashov"],
        redirects: true
      })
      .then(function (results) {
        assert.equal(results[0].id, "Q82174");
      });
  });

  it("mapRedirects Brashov to Brașov", function () {
    return index.mapRedirects(["Brashov"], "ro").then(function (results) {
      assert.equal(Object.keys(results).length, 1);
      assert.equal(results["Brashov"], "Brașov");
    });
  });
});
