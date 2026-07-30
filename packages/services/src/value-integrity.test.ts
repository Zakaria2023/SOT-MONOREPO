import { describe, expect, it } from "vitest";
import type { Operand, ProductValues, SpecGroupField } from "../../../db/types";
import {
  completenessProblems,
  outOfSliceValues,
  type AssignmentDefinition,
  type ResolvedAssignment,
} from "./assignment-resolver";
import { evaluatePredicate } from "./predicate";
import {
  groupRowIssues,
  groupSubField,
  groupTotal,
  indexAttributes,
  isCompleteGroupRow,
  normalizeGroupRows,
  type AttributeMeta,
} from "./spec-values";

// ---------------------------------------------------------------------------
// VALUE INTEGRITY — the failures that look like approval.
//
// Every case below shares one shape: the data is wrong, nothing errors, and the
// rule that should have caught it simply does not fire. A rule that never fires
// is indistinguishable from a rule nothing violated, which is why each of these
// has to become loud somewhere.
// ---------------------------------------------------------------------------

const PORTS = "attr-ports";
const SPEED = "attr-speed";

// "Network Ports" as authored: a count, and an ordered speed.
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
    key: "max-speed",
    label: "Max speed",
    kind: "select",
    unit: null,
    ordered: true,
    options: [
      { value: "1g", label: "1G", rank: 1000, retired: false },
      { value: "10g", label: "10G", rank: 10000, retired: false },
    ],
  },
];

const ports: AttributeMeta = {
  uuid: PORTS,
  label: "Network Ports",
  type: "group",
  unit: null,
  ordered: false,
  options: [],
  groupFields: portFields,
};

const speed: AttributeMeta = {
  uuid: SPEED,
  label: "Uplink speed",
  type: "single_select",
  unit: null,
  ordered: true,
  options: [
    { value: "1g", label: "1G", rank: 1000, retired: false },
    { value: "10g", label: "10G", rank: 10000, retired: false },
  ],
};

// ---------------------------------------------------------------------------
// A pick that is not on the list
// ---------------------------------------------------------------------------

describe("a group pick outside its sub-field's list", () => {
  const rogue = [{ count: 24, "max-speed": "40g" }];

  it("makes the row unreadable rather than half-readable", () => {
    // 40G is not an option. Nothing can rank it, so a speed comparison on this
    // row would have no answer — the row is as unreadable as a blank one.
    expect(isCompleteGroupRow(rogue[0] ?? {}, portFields)).toBe(false);
  });

  it("is refused on the way IN, so it cannot be stored", () => {
    expect(normalizeGroupRows(rogue, portFields)).toEqual([]);
  });

  it("is named on the way OUT, for whatever is already stored", () => {
    expect(groupRowIssues(rogue, ports)).toEqual([
      {
        row: 1,
        fieldKey: "max-speed",
        fieldLabel: "Max speed",
        problem: "unknown_value",
        value: "40g",
      },
    ]);
  });

  it("is TOLERATED when the list resolved to nothing, so a missing shared list does not erase rows", () => {
    // A sub-field whose shared vocabulary has gone missing resolves to no
    // options. Dropping every row then would make a switch read as having no
    // ports — and the COUNT in those rows is still perfectly readable.
    const unresolved: SpecGroupField[] = portFields.map((field) =>
      field.kind === "select" ? { ...field, options: [] } : field,
    );
    expect(normalizeGroupRows(rogue, unresolved)).toEqual([
      { count: 24, "max-speed": "40g" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// A sub-field added after the rows were entered
// ---------------------------------------------------------------------------

describe("adding a sub-field to a group that already holds rows", () => {
  // Entered when the schema was {count, max-speed}. A "Family" column is added.
  const stored = [
    { count: 24, "max-speed": "1g" },
    { count: 8, "max-speed": "10g" },
  ];
  const grown: AttributeMeta = {
    ...ports,
    groupFields: [
      ...portFields,
      {
        key: "family",
        label: "Family",
        kind: "select",
        unit: null,
        ordered: false,
        options: [{ value: "sfp", label: "SFP", rank: null, retired: false }],
      },
    ],
  };

  it("makes every stored row unreadable — this is the danger, stated", () => {
    expect(groupTotal(stored, grown, "count")).toBeNull();
  });

  it("reports one issue per row, naming the column that is now missing", () => {
    const issues = groupRowIssues(stored, grown);
    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.problem === "missing")).toBe(true);
    expect(issues.every((issue) => issue.fieldLabel === "Family")).toBe(true);
    expect(issues.map((issue) => issue.row)).toEqual([1, 2]);
  });

  it("still totals correctly against the schema the rows WERE entered under", () => {
    // Proof the rows themselves are fine and it is only the schema that moved.
    expect(groupTotal(stored, ports, "count")).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// Completeness — where all of the above becomes visible
// ---------------------------------------------------------------------------

const definition = (meta: AttributeMeta): AssignmentDefinition => ({
  ...meta,
  key: meta.label.toLowerCase(),
  internalName: null,
  description: null,
  audience: "everyone",
  allowRange: false,
  order: 0,
  groupUuid: null,
});

const assignment = (
  meta: AttributeMeta,
  offered = meta.options,
): ResolvedAssignment => ({
  isFilter: false,
  isRule: true,
  scope: "branch",
  showIf: null,
  audience: "everyone",
  enabledValues: null,
  suppressed: false,
  order: 0,
  definition: definition(meta),
  effectiveAudience: "everyone",
  sourceCategoryUuid: "cat",
  inherited: false,
  offeredOptions: offered,
});

describe("completenessProblems", () => {
  it("reports a group whose rows no longer answer the schema", () => {
    // hasValue() says this product HAS ports — the rows are well-formed objects.
    // Without this check the product reads as complete and passes every port
    // check while the engine can read nothing at all.
    const grown: AttributeMeta = {
      ...ports,
      groupFields: [
        ...portFields,
        {
          key: "family",
          label: "Family",
          kind: "select",
          unit: null,
          ordered: false,
          options: [{ value: "sfp", label: "SFP", rank: null, retired: false }],
        },
      ],
    };
    const values: ProductValues = {
      [PORTS]: [{ count: 24, "max-speed": "1g" }],
    };
    const problems = completenessProblems([assignment(grown)], values);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.kind).toBe("incomplete_rows");
    expect(problems[0]?.detail).toContain("1 of 1 row(s) cannot be read");
    expect(problems[0]?.detail).toContain("row 1 has no Family");
  });

  it("says nothing about a group whose rows DO answer the schema", () => {
    const values: ProductValues = {
      [PORTS]: [{ count: 24, "max-speed": "1g" }],
    };
    expect(completenessProblems([assignment(ports)], values)).toEqual([]);
  });

  it("separates a value the library never knew from one this category merely does not offer", () => {
    // Outside the slice but known: the library has 10G, this category stops at
    // 1G. A real switch may do 10G, so it is allowed and surfaced.
    const narrowed = assignment(speed, [
      { value: "1g", label: "1G", rank: 1000, retired: false },
    ]);
    const known = completenessProblems([narrowed], { [SPEED]: "10g" });
    expect(known[0]?.kind).toBe("outside_slice");

    // Outside the library entirely: no option carries "40g", so nothing can rank
    // it, match it or render it. Widening the slice could never fix this.
    const unknown = completenessProblems([narrowed], { [SPEED]: "40g" });
    expect(unknown[0]?.kind).toBe("unknown_value");
    expect(unknown[0]?.detail).toContain("40g");
  });

  it("treats a RETIRED value as known, not unknown", () => {
    const withRetired: AttributeMeta = {
      ...speed,
      options: [{ value: "1g", label: "1G", rank: 1000, retired: true }],
    };
    // Offered is empty because the option is retired; the value is still known.
    const problems = completenessProblems([assignment(withRetired, [])], {
      [SPEED]: "1g",
    });
    expect(problems[0]?.kind).toBe("outside_slice");
  });
});

describe("outOfSliceValues", () => {
  it("does not mistake a group's rows for select values", () => {
    // asOptionList refuses group rows, so a group can never appear here — the
    // alternative was every row stringifying to "[object Object]" and being
    // reported as an out-of-slice value.
    expect(
      outOfSliceValues([assignment(ports)], {
        [PORTS]: [{ count: 4, "max-speed": "1g" }],
      }),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The engine and the evaluator
// ---------------------------------------------------------------------------

describe("a stored value the definition does not know", () => {
  const attributes = indexAttributes([speed]);

  it("reports as MISSING rather than silently failing to match", () => {
    // This was the quietest bug in the system: "40g" matched nothing, reported
    // nothing, and the product dropped out of every rule reading the attribute —
    // which looks exactly like a product the rule examined and approved.
    const result = evaluatePredicate(
      { op: "in", attr: SPEED, values: ["1g", "10g"], mode: "any" },
      { [SPEED]: "40g" },
      attributes,
    );
    expect(result.matched).toBe(false);
    expect(result.missing).toEqual([SPEED]);
  });

  it("does not let a NEGATED test pass on an unreadable value", () => {
    // `not_in` on unreadable data would otherwise return true and satisfy a
    // requirement by accident — the worst possible direction for this to fail.
    const result = evaluatePredicate(
      { op: "not_in", attr: SPEED, values: ["1g"] },
      { [SPEED]: "40g" },
      attributes,
    );
    expect(result.matched).toBe(false);
    expect(result.missing).toEqual([SPEED]);
  });

  it("still matches a value the definition DOES know", () => {
    const result = evaluatePredicate(
      { op: "in", attr: SPEED, values: ["1g"], mode: "any" },
      { [SPEED]: "1g" },
      attributes,
    );
    expect(result.matched).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe("an operand that names a group sub-field", () => {
  it("finds the sub-field it names, and nothing it does not", () => {
    expect(groupSubField(ports, "count")?.label).toBe("Ports");
    expect(groupSubField(ports, "nope")).toBeNull();
    // A non-group has no sub-fields at all, so this stays null rather than
    // throwing on a definition that never had a schema.
    expect(groupSubField(speed, "count")).toBeNull();
  });

  it("totals the column across rows — 50 ports, not 4 port groups", () => {
    // The plausible wrong answer is 4 (the number of rows). Nothing would have
    // reported the difference, which is why `asNumber` refuses a group outright
    // and the operand has to name a column.
    const rows = [
      { count: 24, "max-speed": "1g" },
      { count: 16, "max-speed": "10g" },
      { count: 8, "max-speed": "10g" },
      { count: 2, "max-speed": "10g" },
    ];
    const operand: Operand = {
      source: "spec",
      specUuid: PORTS,
      groupField: "count",
    };
    expect(operand.groupField).toBe("count");
    expect(groupTotal(rows, ports, "count")).toBe(50);
  });

  it("refuses to total a column that holds picks rather than counts", () => {
    const rows = [{ count: 24, "max-speed": "1g" }];
    expect(groupTotal(rows, ports, "max-speed")).toBeNull();
  });
});
