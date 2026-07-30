import { describe, expect, it } from "vitest";
import {
  isSpecGroupRows,
  type SpecGroupField,
  type SpecGroupRow,
} from "../../../db/types";
import { mergeGroupFields } from "./library-options";
import {
  asNumber,
  asOptionList,
  completeGroupRows,
  describeValue,
  groupPicks,
  groupTotal,
  hasValue,
  type AttributeMeta,
} from "./spec-values";

// "Network Ports" as the model actually defines it: a count, an unordered family
// and an ordered speed. The four rows below are the Core switch from the
// datasheet — 24 × 1G BASE-T, 16 × 10G SFP, 8 × 25G SFP, 2 × 100G QSFP.
const portFields: SpecGroupField[] = [
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
      { value: "base-t", label: "BASE-T", rank: null, retired: false },
      { value: "sfp", label: "SFP", rank: null, retired: false },
      { value: "qsfp", label: "QSFP", rank: null, retired: false },
    ],
  },
  {
    key: "max-speed",
    label: "Max speed",
    kind: "select",
    unit: null,
    // Ranked by real magnitude in Mbps, so `lte` orders them and the rank
    // doubles as something a human can explain.
    ordered: true,
    options: [
      { value: "1g", label: "1G", rank: 1000, retired: false },
      { value: "10g", label: "10G", rank: 10000, retired: false },
      { value: "25g", label: "25G", rank: 25000, retired: false },
      { value: "100g", label: "100G", rank: 100000, retired: false },
    ],
  },
];

const ports: AttributeMeta = {
  uuid: "a-ports",
  label: "Network Ports",
  type: "group",
  unit: null,
  ordered: false,
  options: [],
  groupFields: portFields,
};

const coreSwitch: SpecGroupRow[] = [
  { count: 24, family: "base-t", "max-speed": "1g" },
  { count: 16, family: "sfp", "max-speed": "10g" },
  { count: 8, family: "sfp", "max-speed": "25g" },
  { count: 2, family: "qsfp", "max-speed": "100g" },
];

// A multi-select on the same product, to prove the two array shapes never get
// confused for one another.
const codecs: AttributeMeta = {
  uuid: "a-codecs",
  label: "Voice Codecs",
  type: "multi_select",
  unit: null,
  ordered: false,
  options: [
    { value: "opus", label: "Opus", rank: null, retired: false },
    { value: "g711", label: "G.711", rank: null, retired: false },
  ],
};

describe("isSpecGroupRows", () => {
  it("accepts a well-formed row list", () => {
    expect(isSpecGroupRows(coreSwitch)).toBe(true);
  });

  it("rejects a multi-select, which is an array too", () => {
    expect(isSpecGroupRows(["opus", "g711"])).toBe(false);
  });

  it("rejects an empty list — a group with no rows is unanswered", () => {
    expect(isSpecGroupRows([])).toBe(false);
  });

  it("rejects a row holding a non-finite number", () => {
    expect(isSpecGroupRows([{ count: Number.NaN, family: "sfp" }])).toBe(false);
  });

  it("rejects a row holding a nested object", () => {
    expect(isSpecGroupRows([{ count: 4, family: { value: "sfp" } }])).toBe(
      false,
    );
  });

  it("rejects a list mixing rows and plain strings", () => {
    expect(isSpecGroupRows([{ count: 4 }, "sfp"])).toBe(false);
  });
});

describe("hasValue on a group", () => {
  it("counts a well-formed row list as answered", () => {
    expect(hasValue(coreSwitch)).toBe(true);
  });

  it("counts an empty row list as unanswered", () => {
    expect(hasValue([])).toBe(false);
  });

  it("counts a MALFORMED row list as unanswered, not as answered", () => {
    // Unreadable and absent must not collapse into each other: a row list the
    // readers cannot decode has to stay out of every rule rather than be
    // half-counted.
    expect(hasValue([{ count: Number.NaN }])).toBe(false);
  });

  it("still counts a multi-select as answered", () => {
    expect(hasValue(["opus"])).toBe(true);
  });
});

describe("group rows never leak into the scalar readers", () => {
  it("asOptionList returns nothing rather than stringifying rows", () => {
    // The bug this guards: `map(String)` over rows yields "[object Object]",
    // which then silently fails to match any option and reports as a clean pass.
    expect(asOptionList(coreSwitch)).toEqual([]);
  });

  it("asOptionList still reads a multi-select", () => {
    expect(asOptionList(["opus", "g711"])).toEqual(["opus", "g711"]);
  });

  it("asNumber refuses a group rather than returning the row count", () => {
    // 4 (groups) instead of 50 (ports) is the dangerous wrong answer, because
    // it is plausible. Null forces the caller to name a sub-field.
    expect(asNumber(coreSwitch, ports)).toBeNull();
  });
});

describe("groupTotal", () => {
  it("sums a numeric sub-field across every row", () => {
    expect(groupTotal(coreSwitch, ports, "count")).toBe(50);
  });

  it("refuses a sub-field that is a pick, not a quantity", () => {
    expect(groupTotal(coreSwitch, ports, "family")).toBeNull();
  });

  it("refuses a sub-field the schema does not define", () => {
    expect(groupTotal(coreSwitch, ports, "poe")).toBeNull();
  });

  it("drops an incomplete row instead of counting it as zero", () => {
    // A count with no speed is half a port group. Counting its 4 ports would
    // put ports on the balance sheet that no rule can place.
    const rows: SpecGroupRow[] = [
      { count: 24, family: "base-t", "max-speed": "1g" },
      { count: 4, family: "sfp" },
    ];
    expect(groupTotal(rows, ports, "count")).toBe(24);
  });

  it("returns null when no row is complete", () => {
    expect(groupTotal([{ count: 4 }], ports, "count")).toBeNull();
  });

  it("returns null for a value that is not a group at all", () => {
    expect(groupTotal(42, ports, "count")).toBeNull();
  });
});

describe("groupPicks", () => {
  it("collects the distinct picks in row order", () => {
    expect(groupPicks(coreSwitch, ports, "family")).toEqual([
      "base-t",
      "sfp",
      "qsfp",
    ]);
  });

  it("answers the membership question a rule actually asks", () => {
    expect(groupPicks(coreSwitch, ports, "max-speed")).toContain("100g");
    expect(groupPicks(coreSwitch, ports, "max-speed")).not.toContain("40g");
  });

  it("refuses a numeric sub-field", () => {
    expect(groupPicks(coreSwitch, ports, "count")).toEqual([]);
  });

  it("ignores picks that sit on an incomplete row", () => {
    const rows: SpecGroupRow[] = [
      { count: 24, family: "base-t", "max-speed": "1g" },
      { family: "qsfp", "max-speed": "100g" },
    ];
    expect(groupPicks(rows, ports, "family")).toEqual(["base-t"]);
  });
});

describe("completeGroupRows", () => {
  it("keeps only the rows every sub-field is filled on", () => {
    const rows: SpecGroupRow[] = [
      { count: 24, family: "base-t", "max-speed": "1g" },
      { count: 4, family: "sfp" },
      { count: 2, family: "qsfp", "max-speed": "100g" },
    ];
    expect(completeGroupRows(rows, ports)).toHaveLength(2);
  });

  it("treats a blank pick as unfilled", () => {
    expect(
      completeGroupRows([{ count: 4, family: "  ", "max-speed": "1g" }], ports),
    ).toEqual([]);
  });

  it("reads a group as empty when the schema is missing", () => {
    // Every row is vacuously complete against an empty schema, so the guarantee
    // has to come from the library refusing to SAVE a group with no sub-fields.
    const schemaless: AttributeMeta = { ...ports, groupFields: undefined };
    expect(groupTotal(coreSwitch, schemaless, "count")).toBeNull();
  });
});

describe("describeValue on a group", () => {
  it("renders rows with option labels, not stored values", () => {
    expect(describeValue(coreSwitch, ports)).toBe(
      "24 · BASE-T · 1G, 16 · SFP · 10G, 8 · SFP · 25G, 2 · QSFP · 100G",
    );
  });

  it("appends a sub-field's unit", () => {
    const outlets: AttributeMeta = {
      uuid: "a-outlets",
      label: "Outlets",
      type: "group",
      unit: null,
      ordered: false,
      options: [],
      groupFields: [
        {
          key: "type",
          label: "Outlet",
          kind: "select",
          unit: null,
          ordered: false,
          options: [{ value: "c13", label: "C13", rank: null, retired: false }],
        },
        {
          key: "count",
          label: "How many",
          kind: "number",
          unit: "outlets",
          ordered: false,
          options: [],
        },
      ],
    };
    expect(describeValue([{ type: "c13", count: 8 }], outlets)).toBe(
      "C13 · 8 outlets",
    );
  });

  it("marks a missing sub-field rather than inventing one", () => {
    expect(describeValue([{ count: 4, family: "sfp" }], ports)).toBe(
      "4 · SFP · —",
    );
  });

  it("leaves the other types alone", () => {
    expect(describeValue(["opus", "g711"], codecs)).toBe("Opus, G.711");
  });
});

describe("mergeGroupFields", () => {
  const input = (
    label: string,
    kind: "number" | "select",
    extra: Partial<{
      key: string;
      unit: string | null;
      ordered: boolean;
      options: { value?: string; label: string; rank: number | null }[];
    }> = {},
  ) => ({
    label,
    kind,
    unit: extra.unit ?? null,
    ordered: extra.ordered ?? false,
    options: extra.options ?? [],
    ...(extra.key ? { key: extra.key } : {}),
  });

  it("derives a stable key from the label", () => {
    const merged = mergeGroupFields(
      [],
      [
        input("Max speed", "select", {
          options: [{ label: "1G", rank: 1 }],
        }),
      ],
    );
    expect(merged[0]?.key).toBe("max-speed");
  });

  it("keeps an existing key when the label is renamed", () => {
    // The key is what a stored row is keyed by, so re-deriving it from a new
    // label would orphan every row the product already holds.
    const existing = mergeGroupFields(
      [],
      [input("Ports", "number", { unit: "ports" })],
    );
    const renamed = mergeGroupFields(existing, [
      input("Port count", "number", { key: existing[0]?.key, unit: "ports" }),
    ]);
    expect(renamed[0]?.key).toBe("ports");
    expect(renamed[0]?.label).toBe("Port count");
  });

  it("never lets a new sub-field take a key an existing one owns", () => {
    const existing = mergeGroupFields([], [input("Ports", "number")]);
    const merged = mergeGroupFields(existing, [
      input("Ports", "number", { key: "ports" }),
      input("Ports", "select", { options: [{ label: "Front", rank: null }] }),
    ]);
    expect(merged.map((field) => field.key)).toEqual(["ports", "ports-2"]);
  });

  it("drops a sub-field with no label", () => {
    expect(mergeGroupFields([], [input("  ", "number")])).toEqual([]);
  });

  it("normalises a number sub-field to its own kind", () => {
    const merged = mergeGroupFields(
      [],
      [
        input("Ports", "number", {
          unit: "ports",
          ordered: true,
          options: [{ label: "Nonsense", rank: null }],
        }),
      ],
    );
    expect(merged[0]).toMatchObject({
      kind: "number",
      unit: "ports",
      ordered: false,
      options: [],
    });
  });

  it("normalises a select sub-field to its own kind", () => {
    const merged = mergeGroupFields(
      [],
      [
        input("Family", "select", {
          unit: "should-be-dropped",
          options: [{ label: "SFP", rank: null }],
        }),
      ],
    );
    expect(merged[0]?.unit).toBeNull();
    expect(merged[0]?.options).toHaveLength(1);
  });

  it("retires a removed option rather than deleting it", () => {
    // The append-only guarantee has to reach INSIDE a group, or a product's row
    // ends up pointing at a pick that no longer exists.
    const existing = mergeGroupFields(
      [],
      [
        input("Family", "select", {
          options: [
            { label: "SFP", rank: null },
            { label: "QSFP", rank: null },
          ],
        }),
      ],
    );
    const merged = mergeGroupFields(existing, [
      input("Family", "select", {
        key: "family",
        options: [{ value: "sfp", label: "SFP", rank: null }],
      }),
    ]);
    expect(merged[0]?.options).toEqual([
      { value: "sfp", label: "SFP", rank: null, retired: false },
      { value: "qsfp", label: "QSFP", rank: null, retired: true },
    ]);
  });

  it("ranks every option on an ordered sub-field", () => {
    const merged = mergeGroupFields(
      [],
      [
        input("Max speed", "select", {
          ordered: true,
          options: [
            { label: "1G", rank: 1000 },
            { label: "10G", rank: null },
          ],
        }),
      ],
    );
    // An ordered scale with a null rank has nothing for `lte` to compare, so the
    // position stands in rather than leaving a hole.
    expect(merged[0]?.options.map((option) => option.rank)).toEqual([1000, 2]);
  });
});
