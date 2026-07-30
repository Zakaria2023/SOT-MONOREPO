import { describe, expect, it } from "vitest";
import type { Predicate, SpecGroupField } from "../../../db/types";
import {
  evaluatePredicate,
  filteredGroupTotal,
  groupRowAttributes,
  matchingGroupRows,
  validatePredicate,
} from "./predicate";
import { indexAttributes, type AttributeMeta } from "./spec-values";

// ---------------------------------------------------------------------------
// ROW-FILTERED READS — "how many 10G ports", finally.
//
// Before this, a rule could total a column (Σ ports) or test its picks (is any
// port 10G) but not total the rows matching a pick. The two available questions
// answer YES for a switch with a 1G SFP cage and a 10G RJ45 port, which is
// exactly the switch that has no 10G SFP uplink at all.
//
// The dangerous half is not the arithmetic, it is the empty case: a product with
// readable rows and none matching measures ZERO, while a product with no readable
// rows measures NOTHING. Collapsing those makes a rule skip the products it was
// written for, and a skipped check reads as a passed one.
// ---------------------------------------------------------------------------

const PORTS = "attr-ports";

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
    key: "speed",
    label: "Speed",
    kind: "select",
    unit: null,
    ordered: true,
    options: [
      { value: "1g", label: "1G", rank: 1000, retired: false },
      { value: "10g", label: "10G", rank: 10000, retired: false },
    ],
  },
  {
    key: "family",
    label: "Family",
    kind: "select",
    unit: null,
    ordered: false,
    options: [
      { value: "rj45", label: "RJ45", rank: null, retired: false },
      { value: "sfp", label: "SFP", rank: null, retired: false },
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

const attributes = indexAttributes([ports]);

// 48 × 1G RJ45, 4 × 10G SFP — an ordinary access switch.
const accessSwitch = [
  { count: 48, speed: "1g", family: "rj45" },
  { count: 4, speed: "10g", family: "sfp" },
];

// The switch the two existing questions get wrong: an SFP cage that is only 1G,
// and a 10G port that is not SFP.
const misleadingSwitch = [
  { count: 24, speed: "1g", family: "rj45" },
  { count: 2, speed: "1g", family: "sfp" },
  { count: 1, speed: "10g", family: "rj45" },
];

const is = (field: string, value: string): Predicate => ({
  op: "in",
  attr: field,
  values: [value],
  mode: "any",
});

describe("matchingGroupRows", () => {
  it("keeps only the rows the filter names", () => {
    const rows = matchingGroupRows(accessSwitch, ports, is("speed", "10g"));
    expect(rows).toEqual([{ count: 4, speed: "10g", family: "sfp" }]);
  });

  it("answers about ONE row, which two separate conditions cannot", () => {
    // The whole reason this exists. "Some row is SFP" and "some row is 10G" are
    // both true of the misleading switch; "some row is a 10G SFP" is not.
    const both: Predicate = {
      op: "all",
      children: [is("speed", "10g"), is("family", "sfp")],
    };
    expect(matchingGroupRows(accessSwitch, ports, both)).toHaveLength(1);
    expect(matchingGroupRows(misleadingSwitch, ports, both)).toHaveLength(0);
  });

  it("drops a row that cannot answer the filter rather than keeping it", () => {
    // Same call the readers make for a row that does not answer its schema.
    // Keeping it would let a total quietly include rows nobody can read.
    const rows = matchingGroupRows(accessSwitch, ports, is("cage", "sfp"));
    expect(rows).toEqual([]);
  });

  it("runs the full operator set, because it is the same evaluator", () => {
    // An ordered comparison inside a row, for free — no second comparison
    // language for rows to drift from the one outside them.
    const fast: Predicate = { op: "gte", attr: "speed", value: 10000 };
    expect(matchingGroupRows(accessSwitch, ports, fast)).toHaveLength(1);

    const many: Predicate = { op: "gt", attr: "count", value: 10 };
    expect(matchingGroupRows(accessSwitch, ports, many)).toHaveLength(1);
  });
});

describe("filteredGroupTotal", () => {
  it("totals only the matching rows", () => {
    expect(
      filteredGroupTotal(accessSwitch, ports, "count", is("speed", "10g")),
    ).toBe(4);
    expect(filteredGroupTotal(accessSwitch, ports, "count")).toBe(52);
  });

  it("measures ZERO when rows are readable and none match", () => {
    // THE case. A switch whose ports are all 1G has no 10G ports — it does not
    // have an unknown number of them. Returning null here would make a rule
    // needing two 10G uplinks skip this switch, and a skipped check is
    // indistinguishable from a passed one.
    expect(
      filteredGroupTotal(misleadingSwitch, ports, "count", {
        op: "all",
        children: [is("speed", "10g"), is("family", "sfp")],
      }),
    ).toBe(0);
  });

  it("measures NOTHING when no row is readable at all", () => {
    // Unanswered, not zero: the product has not said. The rule reports a gap.
    const grown: AttributeMeta = {
      ...ports,
      groupFields: [
        ...portFields,
        {
          key: "poe",
          label: "PoE",
          kind: "select",
          unit: null,
          ordered: false,
          options: [{ value: "yes", label: "Yes", rank: null, retired: false }],
        },
      ],
    };
    expect(
      filteredGroupTotal(accessSwitch, grown, "count", is("speed", "10g")),
    ).toBeNull();
    expect(filteredGroupTotal([], ports, "count")).toBeNull();
  });

  it("still refuses a column that is not a count", () => {
    expect(filteredGroupTotal(accessSwitch, ports, "speed")).toBeNull();
  });
});

describe("a predicate that filters rows", () => {
  const values = { [PORTS]: accessSwitch };
  const misleading = { [PORTS]: misleadingSwitch };

  it("counts only the rows the filter keeps", () => {
    const atLeastTwo10G: Predicate = {
      op: "gte",
      attr: PORTS,
      value: 2,
      field: "count",
      where: is("speed", "10g"),
    };
    expect(evaluatePredicate(atLeastTwo10G, values, attributes).matched).toBe(
      true,
    );
    expect(
      evaluatePredicate(atLeastTwo10G, misleading, attributes).matched,
    ).toBe(false);
  });

  it("reports a shortfall as a real NO, not as missing data", () => {
    const needs: Predicate = {
      op: "gte",
      attr: PORTS,
      value: 2,
      field: "count",
      where: is("speed", "10g"),
    };
    const result = evaluatePredicate(needs, misleading, attributes);
    expect(result.matched).toBe(false);
    // The distinction that decides whether the rule fires or skips.
    expect(result.missing).toEqual([]);
  });

  it("reads `exists` as 'is there a row like that'", () => {
    const hasTenGigSfp: Predicate = {
      op: "exists",
      attr: PORTS,
      field: "count",
      where: { op: "all", children: [is("speed", "10g"), is("family", "sfp")] },
    };
    expect(evaluatePredicate(hasTenGigSfp, values, attributes).matched).toBe(
      true,
    );
    expect(
      evaluatePredicate(hasTenGigSfp, misleading, attributes).matched,
    ).toBe(false);
  });

  it("answers a pick question about the filtered rows only", () => {
    // "Among the 10G ports, is any of them SFP" — true of the access switch,
    // false of the misleading one whose only 10G port is RJ45.
    const tenGigIsSfp: Predicate = {
      op: "in",
      attr: PORTS,
      values: ["sfp"],
      mode: "any",
      field: "family",
      where: is("speed", "10g"),
    };
    expect(evaluatePredicate(tenGigIsSfp, values, attributes).matched).toBe(
      true,
    );
    expect(
      evaluatePredicate(tenGigIsSfp, misleading, attributes).matched,
    ).toBe(false);
  });

  it("calls a rank question over no matching rows answerable", () => {
    // "The fastest SFP cage is at least 10G" on a switch with no SFP at all is
    // NO, not unreadable — there is no such cage for the question to be about.
    const noSfp = { [PORTS]: [{ count: 8, speed: "1g", family: "rj45" }] };
    const fastestSfp: Predicate = {
      op: "gte",
      attr: PORTS,
      value: 10000,
      field: "speed",
      where: is("family", "sfp"),
    };
    const result = evaluatePredicate(fastestSfp, noSfp, attributes);
    expect(result.matched).toBe(false);
    expect(result.missing).toEqual([]);
  });
});

describe("validating a row filter", () => {
  it("catches a filter naming a column that does not exist", () => {
    // Left alone this keeps no rows, so every total becomes a confident zero —
    // the one failure in this feature that looks like a real answer.
    const problems = validatePredicate(
      {
        op: "gte",
        attr: PORTS,
        value: 2,
        field: "count",
        where: is("cage", "sfp"),
      },
      attributes,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe("unknown_attribute");
    // Named as a filter problem, so an author knows which half to fix.
    expect(problems[0]?.message).toContain("Only some rows");
  });

  it("applies the same rules inside the filter as outside it", () => {
    // `family` is unordered, so "at least" has no meaning on it — inside a filter
    // exactly as outside one.
    const problems = validatePredicate(
      {
        op: "gte",
        attr: PORTS,
        value: 2,
        field: "count",
        where: { op: "gte", attr: "family", value: 1 },
      },
      attributes,
    );
    expect(problems.some((problem) => problem.code === "not_ordered")).toBe(
      true,
    );
  });

  it("refuses a filter on an attribute that has no rows", () => {
    const flat: AttributeMeta = {
      uuid: "attr-flat",
      label: "Uplink speed",
      type: "single_select",
      unit: null,
      ordered: true,
      options: [{ value: "1g", label: "1G", rank: 1000, retired: false }],
    };
    const problems = validatePredicate(
      { op: "exists", attr: "attr-flat", where: is("speed", "10g") },
      indexAttributes([flat]),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain("does not hold rows");
  });

  it("refuses a filter inside a filter", () => {
    // Rows do not nest. Allowing the syntax would only produce conditions nobody
    // can read.
    const problems = validatePredicate(
      {
        op: "exists",
        attr: PORTS,
        field: "count",
        where: { op: "exists", attr: "speed", where: is("family", "sfp") },
      },
      attributes,
    );
    expect(problems.some((problem) => problem.message.includes("no rows"))).toBe(
      true,
    );
  });
});

describe("groupRowAttributes", () => {
  it("describes each column as something a predicate can read", () => {
    const index = groupRowAttributes(ports);
    expect([...index.keys()]).toEqual(["count", "speed", "family"]);
    // One row holds ONE pick per column, so a column is single-select even though
    // the group as a whole holds many.
    expect(index.get("speed")?.type).toBe("single_select");
    expect(index.get("speed")?.ordered).toBe(true);
    expect(index.get("count")?.type).toBe("number");
  });
});
