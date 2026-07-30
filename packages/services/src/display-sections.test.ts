import { describe, expect, it } from "vitest";
import { sectionSpecs, type DisplaySpec } from "./display-specs";

// ---------------------------------------------------------------------------
// Sectioning a spec table.
//
// Small, but it is the one thing the storefront spec table and the admin detail
// panel now share, and the bug it guards against is a quiet one: re-sorting by
// group would move a row an author deliberately placed, and nothing would say so.
// ---------------------------------------------------------------------------

const spec = (
  uuid: string,
  label: string,
  groupName: string | null,
): DisplaySpec => ({ uuid, label, value: "yes", groupName });

describe("sectionSpecs", () => {
  it("keeps the order it was handed rather than sorting by group", () => {
    // The caller's order is the category's authored order. Grouping must not
    // reorder within a section, and must not promote a group because it sorts
    // earlier by name.
    const sections = sectionSpecs([
      spec("a", "Ports", "Connectivity"),
      spec("b", "Uplinks", "Connectivity"),
      spec("c", "Input voltage", "Power"),
    ]);
    expect(sections.map((section) => section.name)).toEqual([
      "Connectivity",
      "Power",
    ]);
    expect(sections[0].specs.map((entry) => entry.label)).toEqual([
      "Ports",
      "Uplinks",
    ]);
  });

  it("reopens a group that appears again later", () => {
    // Deliberate: first-seen order decides where a SECTION goes, but a row filed
    // under a group that already appeared belongs with it — otherwise the same
    // group would head two separate blocks and read as two groups.
    const sections = sectionSpecs([
      spec("a", "Ports", "Connectivity"),
      spec("b", "Input voltage", "Power"),
      spec("c", "Uplinks", "Connectivity"),
    ]);
    expect(sections).toHaveLength(2);
    expect(sections[0].specs.map((entry) => entry.label)).toEqual([
      "Ports",
      "Uplinks",
    ]);
  });

  it("collects ungrouped attributes into their own section", () => {
    const sections = sectionSpecs([
      spec("a", "Ports", "Connectivity"),
      spec("b", "Notes", null),
      spec("c", "Origin", null),
    ]);
    expect(sections.map((section) => section.name)).toEqual([
      "Connectivity",
      null,
    ]);
    expect(sections[1].specs).toHaveLength(2);
  });

  it("returns nothing for a product with nothing to show", () => {
    expect(sectionSpecs([])).toEqual([]);
  });
});
