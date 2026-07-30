import { describe, expect, it } from "vitest";
import type { SpecGroupField, SpecOption } from "../../../db/types";
import {
  indexOptionSets,
  mergeGroupFields,
  resolveGroupFields,
  resolveVocabulary,
  usedOptionValues,
  valuesOutsideVocabulary,
  type OptionSetIndex,
} from "./library-options";
import {
  describeValue,
  groupFieldRank,
  optionRank,
  type AttributeMeta,
} from "./spec-values";

// ---------------------------------------------------------------------------
// Shared vocabularies.
//
// The rule these exist to make possible, and the one the last test proves: a
// module fits a cage when the cage's speed is at least the module's. Before sets,
// the cage's speed lived in a sub-field of "Network Ports" and the module's on a
// standalone attribute, each with its own inline list. Both spelled "1G". Neither
// value had anything to do with the other, so the comparison could not be asked
// at all — it did not fail, it was inexpressible.
// ---------------------------------------------------------------------------

const SPEED_SET = "set-speed";

// One list, ranked by real magnitude in Mbps so the rank doubles as something a
// human can explain.
const speedOptions: SpecOption[] = [
  { value: "1g", label: "1G", rank: 1000, retired: false },
  { value: "10g", label: "10G", rank: 10000, retired: false },
  { value: "25g", label: "25G", rank: 25000, retired: false },
];

const sets: OptionSetIndex = indexOptionSets([
  { uuid: SPEED_SET, ordered: true, options: speedOptions },
]);

describe("indexOptionSets", () => {
  it("reads a set that has never been given options as an empty list", () => {
    const index = indexOptionSets([
      { uuid: "set-empty", ordered: false, options: null },
    ]);
    expect(index.get("set-empty")).toEqual({ ordered: false, options: [] });
  });
});

describe("resolveVocabulary", () => {
  it("returns the inline list when nothing is shared", () => {
    expect(
      resolveVocabulary(
        { ordered: true, options: speedOptions, optionSetUuid: null },
        sets,
      ),
    ).toEqual({ ordered: true, options: speedOptions });
  });

  it("treats an absent pointer the same as a null one", () => {
    expect(
      resolveVocabulary({ ordered: false, options: speedOptions }, sets),
    ).toEqual({ ordered: false, options: speedOptions });
  });

  it("lets the pointer WIN over a stale inline list rather than merging them", () => {
    // The inline list here is what a set-linked attribute would have held before
    // it was linked. A union would silently re-admit values the shared list does
    // not have, and there would be no way to tell which list a value came from.
    const stale: SpecOption[] = [
      { value: "1gbps", label: "1 Gbps", rank: null, retired: false },
    ];
    const resolved = resolveVocabulary(
      { ordered: false, options: stale, optionSetUuid: SPEED_SET },
      sets,
    );
    expect(resolved.options).toEqual(speedOptions);
    expect(resolved.options).not.toContainEqual(stale[0]);
  });

  it("takes `ordered` from the SET, so a borrower cannot claim the list is flat", () => {
    // The borrower says false; the set says true. If the borrower won, an `lte`
    // comparison on this attribute would silently return nothing — the worst
    // possible failure, because a rule that matches nothing looks like a rule
    // nothing violated.
    expect(
      resolveVocabulary(
        { ordered: false, options: [], optionSetUuid: SPEED_SET },
        sets,
      ).ordered,
    ).toBe(true);
  });

  it("takes `ordered` from the set the other way round too", () => {
    const flat = indexOptionSets([
      { uuid: "set-colour", ordered: false, options: speedOptions },
    ]);
    expect(
      resolveVocabulary(
        { ordered: true, options: [], optionSetUuid: "set-colour" },
        flat,
      ).ordered,
    ).toBe(false);
  });

  it("resolves a MISSING set to nothing, not back to the inline list", () => {
    // Deletion is refused while anything points at a set, so this is a
    // hand-edited database. An attribute offering nothing is a failure an author
    // reports; one quietly handing out values from a list it no longer uses is a
    // failure nobody sees.
    const resolved = resolveVocabulary(
      { ordered: true, options: speedOptions, optionSetUuid: "set-gone" },
      sets,
    );
    expect(resolved.options).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Group sub-fields
// ---------------------------------------------------------------------------

const cageFields: SpecGroupField[] = [
  {
    key: "count",
    label: "Ports",
    kind: "number",
    unit: null,
    ordered: false,
    options: [],
  },
  {
    key: "family",
    label: "Family",
    kind: "select",
    unit: null,
    ordered: false,
    options: [
      { value: "sfp", label: "SFP", rank: null, retired: false },
      { value: "qsfp", label: "QSFP", rank: null, retired: false },
    ],
  },
  {
    key: "max-speed",
    label: "Max speed",
    kind: "select",
    unit: null,
    // Stored flat and empty, because the set owns both.
    ordered: false,
    options: [],
    optionSetUuid: SPEED_SET,
  },
];

describe("resolveGroupFields", () => {
  const resolved = resolveGroupFields(cageFields, sets);

  it("fills a shared sub-field's options in place", () => {
    expect(resolved[2]?.options).toEqual(speedOptions);
    expect(resolved[2]?.ordered).toBe(true);
  });

  it("leaves an inline sub-field completely alone", () => {
    expect(resolved[1]).toBe(cageFields[1]);
  });

  it("leaves a count alone", () => {
    expect(resolved[0]).toBe(cageFields[0]);
  });

  it("carries the pointer through, so re-saving does not detach the set", () => {
    // The form reopens on what this returns. Dropping the pointer here would make
    // the next save write the resolved options back as an INLINE copy — the
    // sub-field would look identical and quietly stop being comparable.
    expect(resolved[2]?.optionSetUuid).toBe(SPEED_SET);
  });

  it("ignores a pointer on a count, which has no picks to take", () => {
    const odd: SpecGroupField[] = [
      {
        key: "count",
        label: "Ports",
        kind: "number",
        unit: null,
        ordered: false,
        options: [],
        optionSetUuid: SPEED_SET,
      },
    ];
    expect(resolveGroupFields(odd, sets)[0]?.options).toEqual([]);
  });

  it("renders a row with the shared list's LABELS once resolved", () => {
    const meta: AttributeMeta = {
      uuid: "attr-ports",
      label: "Network Ports",
      type: "group",
      unit: null,
      ordered: false,
      options: [],
      groupFields: resolved,
    };
    expect(
      describeValue([{ count: 16, family: "sfp", "max-speed": "10g" }], meta),
    ).toBe("16 · SFP · 10G");
  });
});

// ---------------------------------------------------------------------------
// Storage: a pointer and an inline list are never both kept
// ---------------------------------------------------------------------------

describe("mergeGroupFields with a shared list", () => {
  it("stores no inline options and no `ordered` when a set is named", () => {
    const [field] = mergeGroupFields(
      [],
      [
        {
          label: "Max speed",
          kind: "select",
          unit: null,
          // Both deliberately set, and both must be discarded: an inline copy
          // nothing reads is a copy somebody later mistakes for the truth.
          ordered: true,
          options: [{ label: "1G", rank: 1 }],
          optionSetUuid: SPEED_SET,
        },
      ],
    );
    expect(field?.optionSetUuid).toBe(SPEED_SET);
    expect(field?.options).toEqual([]);
    expect(field?.ordered).toBe(false);
  });

  it("stores the inline list again when the author points the sub-field back at its own", () => {
    const stored: SpecGroupField[] = [
      {
        key: "max-speed",
        label: "Max speed",
        kind: "select",
        unit: null,
        ordered: false,
        options: [],
        optionSetUuid: SPEED_SET,
      },
    ];
    const [field] = mergeGroupFields(stored, [
      {
        key: "max-speed",
        label: "Max speed",
        kind: "select",
        unit: null,
        ordered: true,
        options: [{ label: "1G", rank: 1000 }],
        optionSetUuid: null,
      },
    ]);
    expect(field?.optionSetUuid).toBeNull();
    expect(field?.options).toHaveLength(1);
    expect(field?.options[0]?.rank).toBe(1000);
  });

  it("never keeps a pointer on a count", () => {
    const [field] = mergeGroupFields(
      [],
      [
        {
          label: "Ports",
          kind: "number",
          unit: null,
          ordered: false,
          options: [],
          optionSetUuid: SPEED_SET,
        },
      ],
    );
    expect(field?.optionSetUuid).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Re-pointing without changing what a stored value means
// ---------------------------------------------------------------------------

describe("usedOptionValues", () => {
  it("reads a single-select's answer", () => {
    expect(usedOptionValues(["10g"])).toEqual(["10g"]);
  });

  it("reads every ticked entry of a multi-select, deduplicated", () => {
    expect(usedOptionValues([["1g", "10g"], ["10g"]]).sort()).toEqual([
      "10g",
      "1g",
    ]);
  });

  it("ignores values no option list backs", () => {
    // Re-pointing an option list cannot change what a number or a span means, so
    // these contribute nothing rather than being coerced into option values.
    expect(usedOptionValues([48, true, { min: 4, max: 12 }])).toEqual([]);
  });

  it("does NOT mistake group rows for a multi-select", () => {
    // Rows and `string[]` are both arrays. Without the guard, every row object
    // would stringify into the used set as "[object Object]" and the comparison
    // below would report a stranded value that does not exist.
    expect(usedOptionValues([[{ count: 4, "max-speed": "10g" }]])).toEqual([]);
  });

  it("reads one named column out of a group's rows", () => {
    expect(
      usedOptionValues(
        [
          [
            { count: 16, family: "sfp", "max-speed": "10g" },
            { count: 8, family: "sfp", "max-speed": "25g" },
          ],
        ],
        "max-speed",
      ).sort(),
    ).toEqual(["10g", "25g"]);
  });

  it("skips a row that never filled the column in", () => {
    expect(usedOptionValues([[{ count: 4 }]], "max-speed")).toEqual([]);
  });
});

describe("valuesOutsideVocabulary", () => {
  it("allows a re-point whose destination spells everything already held", () => {
    // The normal case, and the reason this is a check rather than a refusal: an
    // author who builds the shared list out of the attribute's own options gets
    // the same values back, so no meaning changes at all.
    expect(valuesOutsideVocabulary(["1g", "10g"], speedOptions)).toEqual([]);
  });

  it("names the values a destination cannot spell", () => {
    expect(valuesOutsideVocabulary(["1g", "40g"], speedOptions)).toEqual([
      "40g",
    ]);
  });

  it("counts a RETIRED option as spelled", () => {
    // A product holding a retired value still means what it always meant.
    // Retirement stops the value being picked again; it does not strand it.
    const withRetired: SpecOption[] = [
      { value: "1g", label: "1G", rank: 1000, retired: true },
    ];
    expect(valuesOutsideVocabulary(["1g"], withRetired)).toEqual([]);
  });

  it("strands everything when the destination is empty", () => {
    expect(valuesOutsideVocabulary(["1g"], [])).toEqual(["1g"]);
  });
});

// ---------------------------------------------------------------------------
// THE POINT
// ---------------------------------------------------------------------------

describe("the SFP seat rule", () => {
  // A standalone transceiver attribute, pointing at the SAME list as the switch's
  // cage sub-field above.
  const moduleSpeed: AttributeMeta = {
    uuid: "attr-module-speed",
    label: "Module speed",
    type: "single_select",
    ...resolveVocabulary(
      { ordered: false, options: [], optionSetUuid: SPEED_SET },
      sets,
    ),
    unit: null,
  };

  const cageSpeed = resolveGroupFields(cageFields, sets)[2];

  it("gives the cage and the module the same stored values", () => {
    if (!cageSpeed) {
      throw new Error("the cage's speed sub-field is missing");
    }
    expect(cageSpeed.options.map((option) => option.value)).toEqual(
      moduleSpeed.options.map((option) => option.value),
    );
  });

  it("makes cage-speed >= module-speed answerable, which is what was impossible", () => {
    if (!cageSpeed) {
      throw new Error("the cage's speed sub-field is missing");
    }
    // A 10G cage and a 1G module: it fits, and downshifting is a warning rather
    // than a block.
    const cage = groupFieldRank(cageSpeed, "10g");
    const module = optionRank(moduleSpeed, "1g");
    expect(cage).toBe(10000);
    expect(module).toBe(1000);
    if (cage === null || module === null) {
      throw new Error(
        "both ranks are needed for the comparison to mean anything",
      );
    }
    expect(cage >= module).toBe(true);

    // A 1G cage and a 25G module: refused.
    const small = groupFieldRank(cageSpeed, "1g");
    const big = optionRank(moduleSpeed, "25g");
    if (small === null || big === null) {
      throw new Error(
        "both ranks are needed for the comparison to mean anything",
      );
    }
    expect(small >= big).toBe(false);
  });

  it("cannot be asked when each side keeps its own list — the state before sets", () => {
    // Same labels, independently authored. `slugify` happens to derive the same
    // values here, which is exactly what made the old bug so hard to see: the
    // comparison LOOKS fine and is meaningless, because nothing guarantees the two
    // lists stay in step or rank the same way.
    const ownList: AttributeMeta = {
      uuid: "attr-own",
      label: "Module speed",
      type: "single_select",
      unit: null,
      ordered: true,
      options: [
        { value: "1g", label: "1 Gbps", rank: 1, retired: false },
        { value: "25g", label: "25 Gbps", rank: 2, retired: false },
      ],
    };
    // Ranks 1 and 2 against 1000 and 25000. The values collide, the magnitudes do
    // not, and a rule comparing them is comparing list positions with Mbps.
    expect(optionRank(ownList, "1g")).not.toBe(optionRank(moduleSpeed, "1g"));
  });
});
