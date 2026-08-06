import { describe, expect, it } from "vitest";
import {
  incompatiblePairs,
  indexCompatibility,
  isBrandApproved,
  brandVerdict,
  type CompatibilityPair,
} from "./product-compatibility";

// ---------------------------------------------------------------------------
// THE EXCEPTION LIST — pairs the derived rules cannot reach.
//
// The design it defends: compatibility is DERIVED from attributes, so a new SKU
// joins every existing rule the moment its values are filled in. The Ajax matrix
// is 1,141 pairs and almost all of them are already implied — all 23 Fibra
// devices map to exactly the four Fibra-capable hubs, which is what
// `net.link_technology` says. Importing all of them as rows would record the
// answer instead of the reason, and the next product added would be compatible
// with nothing until somebody typed fourteen more rows.
//
// What lands here is the short list that has no attribute behind it: an antenna
// whose fit is a fact about a moulding, a battery cut for one casing.
// ---------------------------------------------------------------------------

const pair = (
  a: string,
  b: string,
  verdict: CompatibilityPair["verdict"],
  note: string | null = null,
): CompatibilityPair => ({
  productUuidA: a,
  productUuidB: b,
  verdict,
  note,
  source: "Ajax device compatibility PDF 2026-08-06",
});

describe("silence is not a refusal", () => {
  const index = indexCompatibility([pair("antenna", "hub-bp", "compatible")]);

  it("says nothing about a pair nobody recorded", () => {
    // The property the whole feature rests on. Reading silence as "these are
    // incompatible" would turn an exception list into a whitelist, and a
    // catalogue of 339 products would need 100,000 rows before anything could be
    // bought.
    expect(brandVerdict(index, "camera", "switch")).toBeNull();
    expect(incompatiblePairs(index, ["camera", "switch"])).toEqual([]);
  });

  it("does not block on a pair recorded as compatible", () => {
    // A permission has nothing to say about a basket on its own.
    expect(incompatiblePairs(index, ["antenna", "hub-bp"])).toEqual([]);
    expect(isBrandApproved(index, "antenna", "hub-bp")).toBe(true);
  });
});

describe("a pair reads the same from either side", () => {
  // Stored directionally, because "a battery fits a hub" is not the sentence
  // "a hub fits a battery". Read from both, because a basket is a bag with no
  // direction in it — and an index that had to be consulted twice would be
  // consulted once on the day it mattered.
  const index = indexCompatibility([
    pair("antenna", "hub-2g", "incompatible", "The antenna does not fit this hub's casing."),
  ]);

  it("finds it whichever way round the basket holds it", () => {
    expect(incompatiblePairs(index, ["antenna", "hub-2g"])).toHaveLength(1);
    expect(incompatiblePairs(index, ["hub-2g", "antenna"])).toHaveLength(1);
  });

  it("reports it in the direction the brand wrote it", () => {
    // So the message reads "the antenna does not fit the hub" rather than
    // whichever line the shopper happened to add first.
    const [finding] = incompatiblePairs(index, ["hub-2g", "antenna"]);
    expect(finding?.productUuidA).toBe("antenna");
    expect(finding?.productUuidB).toBe("hub-2g");
  });

  it("carries the note and the source, because a block has to be defensible", () => {
    const [finding] = incompatiblePairs(index, ["antenna", "hub-2g"]);
    expect(finding?.note).toContain("casing");
    expect(finding?.source).toContain("Ajax");
  });
});

describe("a basket with several exceptions in it", () => {
  const index = indexCompatibility([
    pair("antenna", "hub-2g", "incompatible"),
    pair("battery-95", "hub-plus", "incompatible"),
    pair("antenna", "hub-bp", "compatible"),
  ]);

  it("reports each clash once, not once per ordering", () => {
    // A buyer told the same thing twice about one problem starts discounting
    // the list, and then discounts the real ones too.
    const findings = incompatiblePairs(index, [
      "antenna",
      "hub-2g",
      "battery-95",
      "hub-plus",
    ]);
    expect(findings).toHaveLength(2);
  });

  it("ignores products no pair mentions", () => {
    const findings = incompatiblePairs(index, [
      "antenna",
      "hub-2g",
      "some-camera",
      "some-switch",
    ]);
    expect(findings).toHaveLength(1);
  });

  it("returns nothing for a basket that touches the list only once", () => {
    // A pair needs two sides. One participant is not a pair, and walking the
    // basket for it would be work on every cart render for no possible finding.
    expect(incompatiblePairs(index, ["antenna", "some-camera"])).toEqual([]);
  });

  it("returns nothing for a basket that touches the list not at all", () => {
    expect(incompatiblePairs(index, ["some-camera", "some-switch"])).toEqual([]);
  });
});

describe("an empty list", () => {
  it("blocks nothing, which is the state the catalogue starts in", () => {
    const index = indexCompatibility([]);
    expect(incompatiblePairs(index, ["a", "b", "c"])).toEqual([]);
    expect(isBrandApproved(index, "a", "b")).toBe(false);
  });
});
