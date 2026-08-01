import { describe, expect, it } from "vitest";
import type { ProductValues, SpecGroupField } from "../../../db/types";
import {
  evaluateSelection,
  type EngineContext,
  type EngineItem,
  type EngineRelationship,
} from "./relationship-engine";
import { indexAttributes, type AttributeMeta } from "./spec-values";

// ---------------------------------------------------------------------------
// MATCHING AGAINST A GROUP — the half of the port model that did not work.
//
// A switch's ports are a `group`: four rows of {family, speed, count}. Asking
// "does this transceiver seat in this switch" is a MATCH rule whose provider is
// one COLUMN of those rows.
//
// The match evaluator did not read columns. It called `asOptionList` on the
// stored value, which returns an empty list for group rows on purpose — so the
// provider offered nothing, no consumer could be satisfied by nothing, and every
// consumer failed. On a `block` rule that is not a wrong answer in one cart; it
// is every cart in the catalog stopped, with a message naming real products and
// real values, which is why it survived being looked at.
//
// The tests below are written against the shape the failure took: the pass cases
// would all have been blocks.
// ---------------------------------------------------------------------------

const PORTS = "attr-network-ports";
const MODULE_FAMILY = "attr-module-family";
const MODULE_SPEED = "attr-module-speed";

// One shared vocabulary per column, which is what makes the comparison legal:
// the switch's cage family and the module's family spell SFP identically.
const FAMILIES = [
  {
    value: "base-t",
    label: "BASE-T (RJ45 copper)",
    rank: null,
    retired: false,
  },
  { value: "sfp", label: "SFP (single lane)", rank: null, retired: false },
  { value: "qsfp", label: "QSFP (quad lane)", rank: null, retired: false },
];

const RATES = [
  { value: "1g", label: "1G", rank: 3, retired: false },
  { value: "10g", label: "10G", rank: 6, retired: false },
  { value: "25g", label: "25G", rank: 7, retired: false },
];

const portFields: SpecGroupField[] = [
  {
    key: "family",
    label: "Family",
    kind: "select",
    unit: null,
    ordered: false,
    options: FAMILIES,
  },
  {
    key: "speed",
    label: "Speed",
    kind: "select",
    unit: null,
    // ORDERED on the column, never on the group — a group has no scale of its
    // own, and this is the fact the evaluator had to learn to read.
    ordered: true,
    options: RATES,
  },
  {
    key: "count",
    label: "Ports",
    kind: "number",
    unit: "ports",
    ordered: false,
    options: [],
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

const moduleFamily: AttributeMeta = {
  uuid: MODULE_FAMILY,
  label: "Module family",
  type: "single_select",
  unit: null,
  ordered: false,
  options: FAMILIES,
};

const moduleSpeed: AttributeMeta = {
  uuid: MODULE_SPEED,
  label: "Module speed",
  type: "single_select",
  unit: null,
  ordered: true,
  options: RATES,
};

const context: EngineContext = {
  attributes: indexAttributes([ports, moduleFamily, moduleSpeed]),
  variables: new Map(),
  catalog: [],
};

const item = (name: string, values: ProductValues): EngineItem => ({
  productUuid: name,
  name,
  quantity: 1,
  values,
});

// A 48-port copper switch with four SFP+ uplink cages — the S310-48P4S shape.
const SWITCH = item("S310-48P4S", {
  [PORTS]: [
    { family: "base-t", speed: "1g", count: 48 },
    { family: "sfp", speed: "10g", count: 4 },
  ],
});

const seatRule = (
  overrides: Partial<EngineRelationship> = {},
): EngineRelationship => ({
  uuid: "rule-seat",
  name: "A module must seat in a cage the switch has",
  description: null,
  family: "match",
  gate: "block",
  comparator: "in",
  matchMode: "any",
  headroomPercent: 100,
  ratioLimit: null,
  allocation: "per_unit",
  perItem: false,
  consumer: { source: "spec", specUuid: MODULE_FAMILY },
  provider: { source: "spec", specUuid: PORTS, groupField: "family" },
  consumerWhen: null,
  providerWhen: null,
  lookup: null,
  presence: null,
  scope: null,
  ...overrides,
});

const verdict = (rule: EngineRelationship, selection: EngineItem[]) =>
  evaluateSelection([rule], selection, context).findings[0];

// ---------------------------------------------------------------------------

describe("a match rule can read one column of a group", () => {
  it("seats an SFP module in a switch that has SFP cages", () => {
    // The whole bug in one assertion. Before the fix the provider's value list
    // was empty, so this was a BLOCK — the correct pair, refused.
    expect(
      verdict(seatRule(), [
        SWITCH,
        item("10G SFP+ module", {
          [MODULE_FAMILY]: "sfp",
        }),
      ])?.status,
    ).toBe("pass");
  });

  it("refuses a QSFP module in a switch that has no QSFP cage", () => {
    // And the rule still has to be capable of saying no, or "it passes" is not
    // evidence of anything.
    const finding = verdict(seatRule(), [
      SWITCH,
      item("40G QSFP module", { [MODULE_FAMILY]: "qsfp" }),
    ]);
    expect(finding?.status).toBe("block");
    expect(finding?.failingItems.map((entry) => entry.name)).toEqual([
      "40G QSFP module",
    ]);
  });

  it("names the column, not just the attribute, when it explains itself", () => {
    // "Nothing carries Network Ports" said about a switch with 52 ports is the
    // kind of message that sends someone to re-enter data that is already there.
    const finding = verdict(seatRule(), [
      SWITCH,
      item("40G QSFP module", { [MODULE_FAMILY]: "qsfp" }),
    ]);
    expect(finding?.message).toContain("Network Ports · Family");
  });

  it("offers the LABELS of the column's options, not the stored values", () => {
    const finding = verdict(seatRule(), [
      SWITCH,
      item("40G QSFP module", { [MODULE_FAMILY]: "qsfp" }),
    ]);
    expect(finding?.message).toContain("SFP (single lane)");
    expect(finding?.message).not.toContain("base-t,");
  });

  it("does not apply when the switch's rows cannot be read", () => {
    // A row missing its family answers nothing, and the readers drop it. The
    // rule must fall to not-applicable rather than to a block: an unreadable
    // switch has not failed a check, it has not been checked.
    const broken = item("Switch with half-entered ports", {
      [PORTS]: [{ speed: "10g", count: 4 }],
    });
    expect(
      verdict(seatRule(), [
        broken,
        item("10G SFP+ module", { [MODULE_FAMILY]: "sfp" }),
      ])?.status,
    ).toBe("not_applicable");
  });
});

describe("an ordered column ranks by its own scale", () => {
  // The downshift notice, stated as the thing that SHOULD be true: the module
  // runs at least as fast as the cage it goes in. Violated = it downshifts.
  //
  // The provider is filtered to the SFP rows, and that is not a refinement — it
  // is what makes the rule mean anything. Against every cage on the switch the
  // comparison reads "at least as fast as the SLOWEST cage", which a 1G module
  // in a box with 1G access ports satisfies trivially. The check would pass on
  // every switch ever sold and look like a working rule.
  const downshift = seatRule({
    uuid: "rule-downshift",
    name: "Module runs at the rate of the cage it is in",
    gate: "warn",
    comparator: "gte",
    consumer: { source: "spec", specUuid: MODULE_SPEED },
    provider: {
      source: "spec",
      specUuid: PORTS,
      groupField: "speed",
      where: { op: "equals", attr: "family", value: "sfp" },
    },
  });

  it("warns when the module runs below the cage it seats in", () => {
    // The group carries ordered=false; the SPEED column carries ordered=true.
    // Ranked off the attribute this degrades to membership and says nothing at
    // all — which is the second half of the same bug.
    expect(
      verdict(downshift, [
        SWITCH,
        item("1G SFP module", { [MODULE_SPEED]: "1g" }),
      ])?.status,
    ).toBe("warn");
  });

  it("stays quiet when the module matches the cage exactly", () => {
    // A warning that fires on the right answer is one people learn to click past.
    expect(
      verdict(downshift, [
        SWITCH,
        item("10G SFP+ module", { [MODULE_SPEED]: "10g" }),
      ])?.status,
    ).toBe("pass");
  });

  it("stays quiet when the module is faster than the cage", () => {
    // Over-spec is somebody's money, not a compatibility problem, and the seat
    // rule is what refuses it if it does not physically fit.
    expect(
      verdict(downshift, [
        SWITCH,
        item("25G SFP28 module", { [MODULE_SPEED]: "25g" }),
      ])?.status,
    ).toBe("pass");
  });
});

describe("a row filter narrows which rows the match reads", () => {
  it("compares against only the rows the filter keeps", () => {
    // "Seat it in an UPLINK cage" — the copper access ports are not candidates,
    // even though the switch plainly has them.
    const uplinkOnly = seatRule({
      uuid: "rule-uplink-seat",
      provider: {
        source: "spec",
        specUuid: PORTS,
        groupField: "family",
        where: { op: "equals", attr: "speed", value: "10g" },
      },
    });
    expect(
      verdict(uplinkOnly, [
        SWITCH,
        item("1G BASE-T module", { [MODULE_FAMILY]: "base-t" }),
      ])?.status,
    ).toBe("block");
    expect(
      verdict(uplinkOnly, [
        SWITCH,
        item("10G SFP+ module", { [MODULE_FAMILY]: "sfp" }),
      ])?.status,
    ).toBe("pass");
  });
});
