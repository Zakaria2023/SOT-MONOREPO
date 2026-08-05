import { describe, expect, it } from "vitest";
import { encodeSpecRangeParam, parseSpecRangeParams } from "./index";

const KEY = "2a09f9af-b722-49f2-bc3c-456290bc494e";

describe("parseSpecRangeParams", () => {
  it("reads both bounds", () => {
    expect(parseSpecRangeParams([`${KEY}:8:48`])).toEqual({
      [KEY]: { min: 8, max: 48 },
    });
  });

  it("leaves an omitted end open", () => {
    // "48 or more" and "up to 8" are the two questions a shopper actually asks
    // of a port count; neither carries the other bound.
    expect(parseSpecRangeParams([`${KEY}:48:`])).toEqual({
      [KEY]: { min: 48 },
    });
    expect(parseSpecRangeParams([`${KEY}::8`])).toEqual({
      [KEY]: { max: 8 },
    });
  });

  it("keeps zero, which is a real bound", () => {
    // Falsy in JavaScript, meaningful in a catalogue: "0 to 4" is a filter, and
    // a truthiness check here would silently widen it to "up to 4".
    expect(parseSpecRangeParams([`${KEY}:0:4`])).toEqual({
      [KEY]: { min: 0, max: 4 },
    });
  });

  it("ignores a range with no bounds at all", () => {
    expect(parseSpecRangeParams([`${KEY}::`])).toEqual({});
  });

  it("drops a bound that is not a number rather than reading it as zero", () => {
    // A hand-edited URL must not filter the catalogue down to nothing.
    expect(parseSpecRangeParams([`${KEY}:abc:48`])).toEqual({
      [KEY]: { max: 48 },
    });
    expect(parseSpecRangeParams([`${KEY}:abc:def`])).toEqual({});
  });

  it("ignores malformed entries", () => {
    expect(
      parseSpecRangeParams([KEY, `${KEY}:1`, `${KEY}:1:2:3`, ":1:2"]),
    ).toEqual({});
  });

  it("accepts a single param as well as a list, like the search params give it", () => {
    expect(parseSpecRangeParams(`${KEY}:1:2`)).toEqual({
      [KEY]: { min: 1, max: 2 },
    });
    expect(parseSpecRangeParams(undefined)).toEqual({});
  });

  it("round-trips through the encoder", () => {
    const range = { min: 24, max: 48 };
    expect(parseSpecRangeParams([encodeSpecRangeParam(KEY, range)])).toEqual({
      [KEY]: range,
    });
    expect(
      parseSpecRangeParams([encodeSpecRangeParam(KEY, { min: 24 })]),
    ).toEqual({ [KEY]: { min: 24 } });
  });
});
