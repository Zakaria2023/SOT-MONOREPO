import { describe, expect, it } from "vitest";
import type { ProductValues } from "../../../db/types";
import {
  evaluateSelection,
  type EngineContext,
  type EngineItem,
  type EngineRelationship,
} from "./relationship-engine";
import { indexAttributes, type AttributeMeta } from "./spec-values";

// ---------------------------------------------------------------------------
// STRICTLY BELOW / ABOVE, and why "at most" could not do the job.
//
// A module seats in a cage whose maximum is at or above its own, so the GATE is
// `lte` and it is right. But seating is only half the fact: a 1G module in a 10G
// cage seats perfectly and the link then runs at 1G, which is very likely not
// what the buyer thinks they bought. That notice is exactly "the module is BELOW
// the cage" — and written with `lte` it fires on the correctly matched pair too,
// which is how a warning becomes something people click past without reading.
//
// The second half is the family guard. Both sides carry a speed, so without a
// filter the rule compares an SFP module against a QSFP cage and reports a fit
// that is physically impossible. The engine has always applied `consumerWhen` /
// `providerWhen`; nothing could author them until now.
// ---------------------------------------------------------------------------

// TWO attributes, one shared vocabulary — which is the real shape: a module
// declares the rate it runs at, a cage declares the rate it accepts, and they are
// comparable only because both take their options from one shared list. Reading
// both sides off ONE attribute would put every item on both sides of the rule and
// compare each item with itself.
const MODULE_SPEED = "attr-module-speed";
const CAGE_SPEED = "attr-cage-speed";
const FAMILY = "attr-family";

const RATES = [
  { value: "1g", label: "1G", rank: 1, retired: false },
  { value: "10g", label: "10G", rank: 2, retired: false },
  { value: "25g", label: "25G", rank: 3, retired: false },
];

const moduleSpeed: AttributeMeta = {
  uuid: MODULE_SPEED,
  label: "Module speed",
  type: "single_select",
  unit: null,
  ordered: true,
  options: RATES,
};

const cageSpeed: AttributeMeta = {
  uuid: CAGE_SPEED,
  label: "Cage speed",
  type: "single_select",
  unit: null,
  ordered: true,
  options: RATES,
};

const family: AttributeMeta = {
  uuid: FAMILY,
  label: "Port family",
  type: "single_select",
  unit: null,
  ordered: false,
  options: [
    { value: "sfp", label: "SFP", rank: null, retired: false },
    { value: "qsfp", label: "QSFP", rank: null, retired: false },
  ],
};

const context: EngineContext = {
  attributes: indexAttributes([moduleSpeed, cageSpeed, family]),
  variables: new Map(),
  catalog: [],
};

const rule = (
  comparator: EngineRelationship["comparator"],
  guard = false,
): EngineRelationship => ({
  uuid: `rule-${comparator}-${guard}`,
  name: "Module against cage",
  description: null,
  family: "match",
  gate: "block",
  comparator,
  matchMode: "any",
  headroomPercent: 100,
  ratioLimit: null,
  allocation: "per_unit",
  perItem: false,
  // A is the module, B is the cage.
  consumer: { source: "spec", specUuid: MODULE_SPEED },
  provider: { source: "spec", specUuid: CAGE_SPEED },
  consumerWhen: guard ? { op: "equals", attr: FAMILY, value: "sfp" } : null,
  providerWhen: guard ? { op: "equals", attr: FAMILY, value: "sfp" } : null,
  lookup: null,
  presence: null,
  scope: null,
});

const item = (name: string, values: ProductValues): EngineItem => ({
  productUuid: name,
  name,
  quantity: 1,
  values,
});

const verdict = (
  comparator: EngineRelationship["comparator"],
  selection: EngineItem[],
  guard = false,
) => evaluateSelection([rule(comparator, guard)], selection, context).findings[0];

describe("strictly below", () => {
  it("holds when the module sits under the cage", () => {
    // The downshift case: it seats, and the link runs at the module's rate.
    expect(
      verdict("lt", [
        item("SFP 1G module", { [MODULE_SPEED]: "1g" }),
        item("SFP+ cage", { [CAGE_SPEED]: "10g" }),
      ])?.status,
    ).toBe("pass");
  });

  it("does NOT hold when the two are the same rung", () => {
    // THE case `lte` cannot express. A 10G module in a 10G cage is the right
    // answer, and a downshift notice written with "at most" would fire on it.
    expect(
      verdict("lt", [
        item("SFP+ 10G module", { [MODULE_SPEED]: "10g" }),
        item("SFP+ cage", { [CAGE_SPEED]: "10g" }),
      ])?.status,
    ).toBe("block");
    expect(
      verdict("lte", [
        item("SFP+ 10G module", { [MODULE_SPEED]: "10g" }),
        item("SFP+ cage", { [CAGE_SPEED]: "10g" }),
      ])?.status,
    ).toBe("pass");
  });

  it("does not hold when the module is faster than the cage", () => {
    expect(
      verdict("lt", [
        item("SFP28 25G module", { [MODULE_SPEED]: "25g" }),
        item("SFP+ cage", { [CAGE_SPEED]: "10g" }),
      ])?.status,
    ).toBe("block");
  });
});

describe("strictly above", () => {
  it("is the mirror of below", () => {
    const faster = [
      item("SFP28 25G module", { [MODULE_SPEED]: "25g" }),
      item("SFP+ cage", { [CAGE_SPEED]: "10g" }),
    ];
    expect(verdict("gt", faster)?.status).toBe("pass");
    expect(
      verdict("gt", [
        item("SFP+ 10G module", { [MODULE_SPEED]: "10g" }),
        item("SFP+ cage", { [CAGE_SPEED]: "10g" }),
      ])?.status,
    ).toBe("block");
  });
});

describe("the family guard", () => {
  const sfpModule = item("SFP+ 10G module", {
    [MODULE_SPEED]: "10g",
    [FAMILY]: "sfp",
  });
  const qsfpCage = item("QSFP28 cage", {
    [CAGE_SPEED]: "25g",
    [FAMILY]: "qsfp",
  });

  it("without it, a rule fits an SFP module into a QSFP cage", () => {
    // Both carry a speed, so both join the comparison, and 10G ≤ 25G passes — a
    // physically impossible fit reported as fine. This is the behaviour the
    // filters exist to stop, kept as a test so it cannot come back.
    expect(verdict("lte", [sfpModule, qsfpCage])?.status).toBe("pass");
  });

  it("with it, the QSFP cage is not on either side at all", () => {
    const finding = verdict("lte", [sfpModule, qsfpCage], true);
    expect(finding?.status).toBe("not_applicable");
    expect(finding?.providers.map((p) => p.name)).not.toContain("QSFP28 cage");
  });

  it("still judges a pair inside the same family", () => {
    const sfpCage = item("SFP+ cage", {
      [CAGE_SPEED]: "10g",
      [FAMILY]: "sfp",
    });
    expect(verdict("lte", [sfpModule, sfpCage], true)?.status).toBe("pass");

    const tooFast = item("SFP28 25G module", {
      [MODULE_SPEED]: "25g",
      [FAMILY]: "sfp",
    });
    expect(verdict("lte", [tooFast, sfpCage], true)?.status).toBe("block");
  });
});
