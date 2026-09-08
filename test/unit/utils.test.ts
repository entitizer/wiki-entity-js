import { describe, expect, it } from "vitest";
import {
  chunk,
  isEntityId,
  isItemId,
  isPropertyId,
  uniq
} from "../../src/utils";

describe("uniq", () => {
  it("removes duplicates and preserves first-seen order", () => {
    expect(uniq(["b", "a", "b", "c", "a"])).toEqual(["b", "a", "c"]);
  });

  it("returns a new array", () => {
    const input = ["a"];
    expect(uniq(input)).not.toBe(input);
  });
});

describe("chunk", () => {
  it("splits into groups of at most `size`", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no chunks for an empty input", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it("does not emit a trailing empty chunk on exact multiples", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4]
    ]);
  });

  it("rejects a non-positive size", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });
});

describe("entity id predicates", () => {
  it.each([
    ["Q42", true],
    ["Q1", true],
    ["Q0", false],
    ["Q", false],
    ["P31", false],
    ["q42", false],
    ["Q42x", false],
    ["-1", false]
  ])("isItemId(%s) === %s", (id, expected) => {
    expect(isItemId(id)).toBe(expected);
  });

  it.each([
    ["P31", true],
    ["Q42", false],
    ["P0", false],
    ["P", false]
  ])("isPropertyId(%s) === %s", (id, expected) => {
    expect(isPropertyId(id)).toBe(expected);
  });

  it("accepts both items and properties", () => {
    expect(isEntityId("Q42")).toBe(true);
    expect(isEntityId("P31")).toBe(true);
    expect(isEntityId("L1")).toBe(false);
  });
});
