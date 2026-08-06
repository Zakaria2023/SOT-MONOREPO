import { describe, expect, it } from "vitest";
import type { SpecOption } from "../../../db/types";
import {
  aliasConflicts,
  labelAliasConflicts,
  mergeOptions,
  normalizeAliases,
  resolveAttributeByText,
  resolveOptionByText,
  type NameableAttribute,
} from "./library-options";

// ---------------------------------------------------------------------------
// ALIASES — the same option, spelled the way each source spells it.
//
// Every case below is taken from the real Ajax harvest, because the failure this
// exists to stop is not hypothetical: `||` is how one page renders II on 68
// products, and the same band is written with and without spaces around its dash
// on 82 and 31 products. Left unresolved, each spelling forks the master list and
// half the catalogue silently stops matching every rule keyed on the other half.
// ---------------------------------------------------------------------------

const option = (
  value: string,
  label: string,
  aliases: string[] = [],
): SpecOption => ({ value, label, rank: null, retired: false, aliases });

describe("normalizeAliases", () => {
  it("drops a spelling the option already answers to under its own name", () => {
    const aliases = normalizeAliases(["Class II", "II", "  "], {
      value: "class-ii",
      label: "Class II",
    });
    expect(aliases).toEqual(["II"]);
  });

  it("keeps the first spelling when two differ only by case", () => {
    // Matching is case-insensitive, so storing both would be two entries that can
    // never resolve differently — one of them is dead weight in every conflict
    // report from then on.
    const aliases = normalizeAliases(["II", "ii"], {
      value: "class-2",
      label: "Class 2",
    });
    expect(aliases).toEqual(["II"]);
  });

  it("keeps punctuation, because punctuation is the alias", () => {
    // `||` squashes to nothing. Normalising it away would delete the one spelling
    // that 68 products actually carry.
    expect(
      normalizeAliases(["||"], { value: "class-ii", label: "Class II" }),
    ).toEqual(["||"]);
  });
});

describe("mergeOptions carries aliases", () => {
  it("normalises them against the value it just derived", () => {
    const merged = mergeOptions(
      [],
      [{ label: "Class II", rank: null, aliases: ["||", "Class II", "2"] }],
      false,
    );
    expect(merged[0]?.aliases).toEqual(["||", "2"]);
  });

  it("a retired option keeps its aliases", () => {
    // It still owns its value and products still hold it. Dropping its spellings
    // would let a live option claim one and silently re-point every one of them.
    const existing = [option("class-ii", "Class II", ["||"])];
    const merged = mergeOptions(existing, [], false);
    expect(merged[0]).toMatchObject({ retired: true, aliases: ["||"] });
  });
});

describe("resolveOptionByText", () => {
  const classes = [
    option("class-i", "Class I"),
    option("class-ii", "Class II", ["||"]),
    option("class-iii", "Class III", ["|||"]),
  ];

  it("resolves the brand's pipe rendering onto the roman numeral", () => {
    expect(resolveOptionByText("||", classes)?.value).toBe("class-ii");
    expect(resolveOptionByText("|||", classes)?.value).toBe("class-iii");
  });

  it("resolves the stored value and the label directly", () => {
    expect(resolveOptionByText("class-ii", classes)?.value).toBe("class-ii");
    expect(resolveOptionByText("  class ii  ", classes)?.value).toBe("class-ii");
  });

  it("sees through spacing and dashes on a frequency band", () => {
    // The 82-vs-31 split: two spellings two spaces apart, one band.
    const bands = [option("866-0-866-5-mhz", "866.0–866.5 MHz")];
    expect(resolveOptionByText("866.0 – 866.5 MHz", bands)?.value).toBe(
      "866-0-866-5-mhz",
    );
    expect(resolveOptionByText("866.0-866.5 MHz", bands)?.value).toBe(
      "866-0-866-5-mhz",
    );
  });

  it("returns null rather than guessing when two options answer", () => {
    // A library defect. Picking either one hides it behind data that looks
    // entered, which is the whole failure mode this model exists to prevent.
    const forked = [
      option("a", "Wall", ["SmartBracket"]),
      option("b", "Panel", ["SmartBracket"]),
    ];
    expect(resolveOptionByText("SmartBracket", forked)).toBeNull();
  });

  it("does not let an alias outrank a real stored value", () => {
    // "IP66" is one option's identity and another's nickname. Identity wins, or
    // an alias somebody added last week quietly re-points years of products.
    const ratings = [
      option("ip66", "IP66"),
      option("ip67", "IP67", ["IP66"]),
    ];
    expect(resolveOptionByText("IP66", ratings)?.value).toBe("ip66");
  });

  it("refuses a match too short to be anything but a coincidence", () => {
    // "A" is inside "802.3at" as a substring and means nothing of the sort.
    expect(resolveOptionByText("A", [option("8023at", "802.3at")])).toBeNull();
  });

  it("matches a retired option, rather than tidying history", () => {
    const retired = [{ ...option("cr123a", "CR123A", ["CR 123 A"]), retired: true }];
    expect(resolveOptionByText("CR 123 A", retired)?.value).toBe("cr123a");
  });
});

describe("aliasConflicts", () => {
  it("catches two options claiming one spelling", () => {
    const conflicts = aliasConflicts([
      option("a", "Wall", ["SmartBracket"]),
      option("b", "Panel", ["SmartBracket"]),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.claimedBy.sort()).toEqual(["Panel", "Wall"]);
  });

  it("catches an alias that collides with another option's label", () => {
    const conflicts = aliasConflicts([
      option("desktop", "Desktop", ["Workbench"]),
      option("workbench", "Workbench"),
    ]);
    expect(conflicts).toHaveLength(1);
  });

  it("catches a collision only visible once punctuation is dropped", () => {
    // The hard one to see by eye, and exactly what the loose pass would hit.
    const conflicts = aliasConflicts([
      option("a", "866.0–866.5 MHz", ["866.0 - 866.5 MHz"]),
      option("b", "8660 8665 mhz"),
    ]);
    expect(conflicts).toHaveLength(1);
  });

  it("reports one clash once, not once per side", () => {
    const conflicts = aliasConflicts([
      option("a", "Wall", ["Bracket"]),
      option("b", "Panel", ["Bracket"]),
    ]);
    expect(conflicts).toHaveLength(1);
  });

  it("says nothing about a list where every spelling is unambiguous", () => {
    expect(
      aliasConflicts([
        option("class-ii", "Class II", ["||"]),
        option("class-iii", "Class III", ["|||"]),
      ]),
    ).toEqual([]);
  });

  it("leaves two options sharing a LABEL alone", () => {
    // Always been allowed — `mergeOptions` keeps them apart by value. Refusing it
    // now would reject lists that have saved cleanly for months.
    expect(
      aliasConflicts([option("type-a", "Type"), option("type-b", "Type")]),
    ).toEqual([]);
  });
});

describe("resolveAttributeByText", () => {
  const library: NameableAttribute[] = [
    {
      uuid: "u1",
      key: "det.sensing_elements",
      label: "Sensing elements",
      labelAliases: ["Sensitive element", "Sensitive elements"],
    },
    {
      uuid: "u2",
      key: "av.video_resolution",
      label: "Resolution",
      labelAliases: null,
    },
  ];

  it("collapses the three source spellings onto one attribute", () => {
    for (const written of [
      "Sensitive element",
      "Sensitive elements",
      "Sensing elements",
      "det.sensing_elements",
    ]) {
      expect(resolveAttributeByText(written, library)?.uuid).toBe("u1");
    }
  });

  it("returns null for a column nobody has claimed", () => {
    // Which is the review queue, not a failure.
    expect(resolveAttributeByText("Supported protocols", library)).toBeNull();
  });
});

describe("labelAliasConflicts", () => {
  const existing: NameableAttribute[] = [
    {
      uuid: "u2",
      key: "av.display_resolution",
      label: "Display resolution",
      labelAliases: ["Resolution"],
    },
  ];

  it("refuses a second attribute claiming a label another already answers to", () => {
    // The one from §2.6: Ajax's "Resolution" is a camera's video resolution AND a
    // keypad's screen. Both attributes claiming the source label means an import
    // has to guess, and a shopper filtering cameras gets handed a keypad.
    const conflicts = labelAliasConflicts(
      {
        uuid: "u1",
        key: "av.video_resolution",
        label: "Video resolution",
        labelAliases: ["Resolution"],
      },
      existing,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.alias).toBe("Resolution");
  });

  it("does not report an attribute against itself", () => {
    const self: NameableAttribute = {
      uuid: "u2",
      key: "av.display_resolution",
      label: "Display resolution",
      labelAliases: ["Resolution"],
    };
    expect(labelAliasConflicts(self, existing)).toEqual([]);
  });
});
