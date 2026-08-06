import { describe, expect, it } from "vitest";
import { duplicateGroupRows, type SpecGroupField } from "../../../db/types";
import { columnTotal, groupRowIssues, type AttributeMeta } from "./spec-values";

// ---------------------------------------------------------------------------
// ONE FACT, SEVERAL CASES — the shape §2.3 of the specification document calls
// `conditional_value`, expressed as a group with a discriminator column.
//
// Power draw is one number whose value depends on the supply mode and the load:
// 9 W on 12 V DC, 8.5 W on PoE, 12 W at maximum. Four separate attributes would
// be four facts where there is one, and a rule would have to know which of them
// to read. So it is one attribute holding rows, and the `when` column says which
// case each row answers.
//
// The danger this guards is arithmetic, not authoring: an operand reading a group
// column TOTALS it. Two rows both saying `when = maximum` get summed, and a 12 W
// camera silently measures 24 W. Nothing errors, the rows are perfectly
// well-formed, and the number in the failing budget check traces back to no
// datasheet anywhere.
// ---------------------------------------------------------------------------

const whenField: SpecGroupField = {
  key: "when",
  label: "When",
  kind: "select",
  unit: null,
  ordered: false,
  distinct: true,
  options: [
    { value: "dc12", label: "12 V DC", rank: null, retired: false },
    { value: "poe", label: "PoE", rank: null, retired: false },
    { value: "maximum", label: "maximum", rank: null, retired: false },
  ],
};

const wattsField: SpecGroupField = {
  key: "watts",
  label: "Watts",
  kind: "number",
  unit: "W",
  ordered: false,
  options: [],
};

const powerDraw: AttributeMeta = {
  uuid: "pwr",
  label: "Power draw",
  type: "group",
  unit: null,
  ordered: false,
  options: [],
  groupFields: [whenField, wattsField],
};

describe("a discriminator column answered once per case", () => {
  it("accepts the real shape from the datasheet", () => {
    const rows = [
      { when: "dc12", watts: 9 },
      { when: "poe", watts: 8.5 },
      { when: "maximum", watts: 12 },
    ];
    expect(groupRowIssues(rows, powerDraw)).toEqual([]);
  });

  it("reports a case answered twice", () => {
    const rows = [
      { when: "maximum", watts: 12 },
      { when: "maximum", watts: 12 },
    ];
    const issues = groupRowIssues(rows, powerDraw);
    expect(issues).toEqual([
      {
        row: 2,
        fieldKey: "when",
        fieldLabel: "When",
        problem: "duplicate",
        value: "maximum",
      },
    ]);
  });

  it("blames the LATER row, because that is the one somebody added", () => {
    const rows = [
      { when: "poe", watts: 8.5 },
      { when: "maximum", watts: 12 },
      { when: "poe", watts: 9 },
    ];
    expect(groupRowIssues(rows, powerDraw)[0]?.row).toBe(3);
  });

  it("shows what the silence would have cost", () => {
    // Unreported, this is the whole failure: two well-formed rows, one summed
    // answer, and a 12 W camera that budgets as 24 W.
    const doubled = [
      { when: "maximum", watts: 12 },
      { when: "maximum", watts: 12 },
    ];
    expect(columnTotal(doubled, powerDraw, "watts")).toBe(24);
    expect(groupRowIssues(doubled, powerDraw)).toHaveLength(1);
  });
});

describe("the product form and the engine share one definition", () => {
  // They have to, and they cannot share code the usual way: the form runs in a
  // browser and the engine's module opens a database connection when it loads.
  // So the check lives in `db/types` and both call it — because two definitions
  // of "duplicate" means the one an author is warned about is not the one that
  // decides the arithmetic.
  it("agrees with what the completeness check reports", () => {
    const rows = [
      { when: "poe", watts: 8.5 },
      { when: "maximum", watts: 12 },
      { when: "poe", watts: 9 },
    ];

    // What the product form draws its red line from.
    const live = duplicateGroupRows(rows, whenField);
    // What the engine reports after the save.
    const reported = groupRowIssues(rows, powerDraw).filter(
      (issue) => issue.problem === "duplicate",
    );

    expect(live).toEqual([{ index: 2, value: "poe" }]);
    expect(reported.map((issue) => issue.row)).toEqual(
      live.map((clash) => clash.index + 1),
    );
  });

  it("stays silent on a column that is not a discriminator", () => {
    expect(
      duplicateGroupRows([{ when: "poe" }, { when: "poe" }], {
        ...whenField,
        distinct: false,
      }),
    ).toEqual([]);
  });
});

describe("the ordinary group is untouched", () => {
  // Two identical port rows is a legitimate way to describe 48 ports, and
  // refusing it would break every port group already stored.
  const speedField: SpecGroupField = {
    key: "speed",
    label: "Speed",
    kind: "select",
    unit: null,
    ordered: true,
    options: [
      { value: "1g", label: "1G", rank: 1, retired: false },
      { value: "10g", label: "10G", rank: 2, retired: false },
    ],
  };

  const ports: AttributeMeta = {
    uuid: "ports",
    label: "Network ports",
    type: "group",
    unit: null,
    ordered: false,
    options: [],
    groupFields: [
      speedField,
      { ...wattsField, key: "count", label: "Count", unit: "ports" },
    ],
  };

  it("allows the same pick on two rows when nothing says otherwise", () => {
    const rows = [
      { speed: "1g", count: 24 },
      { speed: "1g", count: 24 },
    ];
    expect(groupRowIssues(rows, ports)).toEqual([]);
    expect(columnTotal(rows, ports, "count")).toBe(48);
  });
});

describe("the flag only means something on a pick", () => {
  it("is ignored on a count column", () => {
    // A count marked distinct would refuse the second `24` in a port group,
    // which is a real switch. The library normalises the flag off on save; this
    // is the reader agreeing, so a hand-edited schema cannot make it bite.
    const oddSchema: AttributeMeta = {
      uuid: "odd",
      label: "Odd",
      type: "group",
      unit: null,
      ordered: false,
      options: [],
      groupFields: [
        { ...wattsField, distinct: true } as SpecGroupField,
        whenField,
      ],
    };
    const rows = [
      { watts: 12, when: "poe" },
      { watts: 12, when: "maximum" },
    ];
    expect(groupRowIssues(rows, oddSchema)).toEqual([]);
  });

  it("says nothing when a group has no discriminator at all", () => {
    const plain: AttributeMeta = {
      ...powerDraw,
      groupFields: [{ ...whenField, distinct: false }, wattsField],
    };
    const rows = [
      { when: "maximum", watts: 12 },
      { when: "maximum", watts: 12 },
    ];
    expect(groupRowIssues(rows, plain)).toEqual([]);
  });
});
