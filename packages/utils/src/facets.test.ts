import { describe, expect, it } from "vitest";
import { expandFacetChoices, type ChoosableFacet } from "./index";

const PORT_SPEED: ChoosableFacet = {
  key: "port-speed",
  ordered: true,
  options: ["100M", "1G", "2.5G", "10G"],
};

const BAND: ChoosableFacet = {
  key: "frequency-band",
  ordered: false,
  options: ["2.4GHz", "5GHz", "6GHz"],
};

describe("expandFacetChoices", () => {
  it("treats an ordered choice as a ceiling", () => {
    // "My network gives 1G" — a device needing 10G is out, one needing 100M
    // still fits.
    expect(
      expandFacetChoices([PORT_SPEED], { "port-speed": ["1G"] }),
    ).toEqual({ "port-speed": ["100M", "1G"] });
  });

  it("takes the highest rung when several are ticked", () => {
    expect(
      expandFacetChoices([PORT_SPEED], { "port-speed": ["100M", "2.5G"] }),
    ).toEqual({ "port-speed": ["100M", "1G", "2.5G"] });
  });

  it("offers everything at the top of the scale", () => {
    expect(
      expandFacetChoices([PORT_SPEED], { "port-speed": ["10G"] })[
        "port-speed"
      ],
    ).toHaveLength(4);
  });

  it("leaves an unordered choice exactly as picked", () => {
    // 6GHz means 6GHz — there is no "or anything below it" on a set.
    expect(
      expandFacetChoices([BAND], { "frequency-band": ["6GHz"] }),
    ).toEqual({ "frequency-band": ["6GHz"] });
  });

  it("keeps several unordered choices as alternatives", () => {
    expect(
      expandFacetChoices([BAND], { "frequency-band": ["2.4GHz", "6GHz"] }),
    ).toEqual({ "frequency-band": ["2.4GHz", "6GHz"] });
  });

  it("matches literally when the choice is no longer on the scale", () => {
    // An option renamed in the library since the URL was shared. Widening to
    // the whole scale would quietly show everything.
    expect(
      expandFacetChoices([PORT_SPEED], { "port-speed": ["40G"] }),
    ).toEqual({ "port-speed": ["40G"] });
  });

  it("drops a choice for a facet this category doesn't offer", () => {
    expect(expandFacetChoices([BAND], { "port-speed": ["1G"] })).toEqual({});
  });

  it("ignores an empty selection", () => {
    expect(expandFacetChoices([PORT_SPEED], { "port-speed": [] })).toEqual({});
  });
});
