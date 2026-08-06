import { describe, expect, it } from "vitest";
import {
  evaluateRelationship,
  type EngineContext,
  type EngineItem,
  type EngineRelationship,
  type EngineVariable,
} from "./relationship-engine";
import { indexAttributes, type AttributeMeta } from "./spec-values";

// ---------------------------------------------------------------------------
// TWO THINGS THE SPECIFICATION DOCUMENT LISTS AS OPEN GAPS, AND ONE OF ITS OWN
// DEFERRALS — each argued here to need no change to the model.
//
// A claim like that is worth nothing as prose. Either the rule can be authored
// against what exists, or it cannot, and the only honest way to say which is to
// author it. So each section below builds the real rule from the document's own
// numbers and runs it.
//
// If a later change breaks one of these, it breaks HERE — which is the point.
// "We decided this was fine" is not something a reader six months from now can
// check; a failing test is.
// ---------------------------------------------------------------------------

const rule = (
  overrides: Partial<EngineRelationship> & {
    uuid: string;
    name: string;
    family: EngineRelationship["family"];
  },
): EngineRelationship => ({
  description: null,
  gate: "block",
  comparator: "lte",
  matchMode: "any",
  headroomPercent: 100,
  ratioLimit: null,
  allocation: "pooled",
  perItem: false,
  consumer: null,
  provider: null,
  consumerWhen: null,
  providerWhen: null,
  lookup: null,
  presence: null,
  scope: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// §6.2.3 — "Nested capacity sub-caps. The EN54 panel allows 200 devices but caps
// extenders at 5 and sirens at 10. Count handles flat caps only."
//
// It does handle them: a sub-cap is not a nested rule, it is a SECOND Count rule
// whose consumer side is narrowed to the devices the sub-cap is about. The panel
// carries one capacity attribute per cap, which §2.8 already lists
// (cap.device_capacity, cap.max_range_extenders), and each rule reads its own.
// ---------------------------------------------------------------------------

const deviceRole: AttributeMeta = {
  uuid: "a-role",
  label: "Device role",
  type: "multi_select",
  unit: null,
  ordered: false,
  options: [
    { value: "extender", label: "Range extender", rank: null, retired: false },
    { value: "siren", label: "Siren", rank: null, retired: false },
    { value: "detector", label: "Detector", rank: null, retired: false },
    { value: "panel", label: "Panel", rank: null, retired: false },
  ],
};

const deviceCapacity: AttributeMeta = {
  uuid: "a-capacity",
  label: "Device capacity",
  type: "number",
  unit: "devices",
  ordered: true,
  options: [],
};

const maxExtenders: AttributeMeta = {
  uuid: "a-max-extenders",
  label: "Maximum range extenders",
  type: "number",
  unit: "devices",
  ordered: true,
  options: [],
};

const maxSirens: AttributeMeta = {
  uuid: "a-max-sirens",
  label: "Maximum sirens",
  type: "number",
  unit: "devices",
  ordered: true,
  options: [],
};

const depth: AttributeMeta = {
  uuid: "a-depth",
  label: "Depth",
  type: "number",
  unit: "mm",
  ordered: true,
  options: [],
};

const usableDepth: AttributeMeta = {
  uuid: "a-usable-depth",
  label: "Usable mounting depth",
  type: "number",
  unit: "mm",
  ordered: true,
  options: [],
};

const attributes = indexAttributes([
  deviceRole,
  deviceCapacity,
  maxExtenders,
  maxSirens,
  depth,
  usableDepth,
]);

const context = (overrides: Partial<EngineContext> = {}): EngineContext => ({
  attributes,
  variables: new Map<string, EngineVariable>(),
  catalog: [],
  ...overrides,
});

// The EN54 Fire Hub: 200 devices in total, 5 extenders, 10 sirens.
const en54Panel: EngineItem = {
  productUuid: "p-panel",
  name: "EN54 Fire Hub",
  quantity: 1,
  values: {
    "a-role": ["panel"],
    "a-capacity": 200,
    "a-max-extenders": 5,
    "a-max-sirens": 10,
  },
};

const extender = (quantity: number): EngineItem => ({
  productUuid: "p-extender",
  name: "EN54 Fire ReX",
  quantity,
  values: { "a-role": ["extender"] },
});

const siren = (quantity: number): EngineItem => ({
  productUuid: "p-siren",
  name: "EN54 FireProtect (Sounder)",
  quantity,
  values: { "a-role": ["siren"] },
});

const detector = (quantity: number): EngineItem => ({
  productUuid: "p-detector",
  name: "EN54 FireProtect (Smoke)",
  quantity,
  values: { "a-role": ["detector"] },
});

// Every device counts against the total. No consumer filter — anything that is
// not the panel itself.
const totalCap = rule({
  uuid: "r-total",
  name: "Panel device capacity",
  family: "count",
  consumer: { source: "item_count" },
  provider: { source: "spec", specUuid: "a-capacity" },
  consumerWhen: {
    op: "not_in",
    attr: "a-role",
    values: ["panel"],
  },
});

// THE SUB-CAP. Identical shape, narrowed consumer, its own capacity attribute.
const extenderCap = rule({
  uuid: "r-extenders",
  name: "Panel range-extender capacity",
  family: "count",
  consumer: { source: "item_count" },
  provider: { source: "spec", specUuid: "a-max-extenders" },
  consumerWhen: {
    op: "in",
    attr: "a-role",
    values: ["extender"],
    mode: "any",
  },
});

const sirenCap = rule({
  uuid: "r-sirens",
  name: "Panel siren capacity",
  family: "count",
  consumer: { source: "item_count" },
  provider: { source: "spec", specUuid: "a-max-sirens" },
  consumerWhen: {
    op: "in",
    attr: "a-role",
    values: ["siren"],
    mode: "any",
  },
});

describe("§6.2.3 nested capacity sub-caps", () => {
  it("passes a design inside every cap", () => {
    const selection = [en54Panel, extender(4), siren(8), detector(50)];
    for (const authored of [totalCap, extenderCap, sirenCap]) {
      expect(evaluateRelationship(authored, selection, context()).status).toBe(
        "pass",
      );
    }
  });

  it("catches a sub-cap breach the total cap would wave through", () => {
    // THE CASE THE DOCUMENT IS WORRIED ABOUT. 6 extenders and 62 devices: the
    // panel's 200-device capacity is nowhere near exhausted, so a flat cap alone
    // reports a design that is fine. The sub-cap is what fails it.
    const selection = [en54Panel, extender(6), siren(6), detector(50)];

    expect(evaluateRelationship(totalCap, selection, context()).status).toBe(
      "pass",
    );
    const breach = evaluateRelationship(extenderCap, selection, context());
    expect(breach.status).toBe("block");

    // The extenders are named as the CONSUMERS of the breached rule, not as
    // failing items — and that is the right answer rather than a gap. Six
    // extenders against a cap of five has no single guilty line: no one of them
    // is the problem, the sixth is only "the sixth" because of the order they
    // were added. A count breach names what was counted, and the buyer removes
    // whichever they like.
    expect(breach.consumers.map((item) => item.productUuid)).toContain(
      "p-extender",
    );
    expect(breach.message).toContain("5");
  });

  it("counts only the devices its own sub-cap is about", () => {
    // 11 sirens breaches the siren cap; the 6 extenders beside them are not the
    // siren rule's business, and a rule that counted both would fail the wrong
    // design and name the wrong line.
    const selection = [en54Panel, siren(11), extender(4)];
    expect(evaluateRelationship(sirenCap, selection, context()).status).toBe(
      "block",
    );
    expect(evaluateRelationship(extenderCap, selection, context()).status).toBe(
      "pass",
    );
  });

  it("breaches the total cap independently of the sub-caps", () => {
    // The two are genuinely separate limits: 201 detectors is a total breach
    // with no sub-cap involved.
    const selection = [en54Panel, detector(201)];
    expect(evaluateRelationship(totalCap, selection, context()).status).toBe(
      "block",
    );
    // NOT "pass" — `not_applicable`. A basket with no extenders in it has not
    // satisfied the extender cap, it has never engaged it, and the engine is
    // right to say so: a check reported as passed is one somebody counts, and
    // counting a check that never ran is how a design looks more validated than
    // it is.
    expect(evaluateRelationship(extenderCap, selection, context()).status).toBe(
      "not_applicable",
    );
  });
});

// ---------------------------------------------------------------------------
// §6.2.5 — "Rack depth vs device depth — a Match rule, still unmodelled. Depth
// mismatches surface on site, not at checkout."
//
// Unmodelled because nothing carried a depth, not because the model could not
// hold one. Convention #6 splits dimensions into three number attributes, and
// with a depth on each side the rule is authorable today.
//
// NOT as Match, though — and the document's own name for it is what misleads.
// Match compares option RANKS and SETS: `matchSatisfied` resolves each value
// through `scaleRank`, and two plain numbers have no options and therefore no
// ranks, so the comparison finds nothing on either side and fails everything.
// Authored that way this rule would block a device that fits.
//
// The numeric family is BUDGET, and `perItem` is the mode that judges each unit
// against the best single provider value instead of summing — "one camera's draw
// vs the per-port maximum", which is structurally the same question as "one
// device's depth vs the rack's usable depth". Summing would be the wrong
// question entirely: four 520 mm servers do not need a 2,080 mm rack.
// ---------------------------------------------------------------------------

const rack: EngineItem = {
  productUuid: "p-rack",
  name: "600 mm rack",
  quantity: 1,
  values: { "a-usable-depth": 600 },
};

const shallowRack: EngineItem = {
  productUuid: "p-rack-shallow",
  name: "450 mm wall cabinet",
  quantity: 1,
  values: { "a-usable-depth": 450 },
};

const deepServer: EngineItem = {
  productUuid: "p-server",
  name: "Deep NVR",
  quantity: 1,
  values: { "a-depth": 520 },
};

const depthRule = rule({
  uuid: "r-depth",
  name: "Device fits the rack's usable depth",
  family: "budget",
  // Each device against the rack's depth on its own. Without this the engine
  // sums the depths, and four 520 mm servers would demand a 2,080 mm rack.
  perItem: true,
  consumer: { source: "spec", specUuid: "a-depth" },
  provider: { source: "spec", specUuid: "a-usable-depth" },
});

describe("§6.2.5 rack depth vs device depth", () => {
  it("passes a device that fits", () => {
    expect(
      evaluateRelationship(depthRule, [rack, deepServer], context()).status,
    ).toBe("pass");
  });

  it("blocks the mismatch that would otherwise surface on site", () => {
    const finding = evaluateRelationship(
      depthRule,
      [shallowRack, deepServer],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.failingItems.map((item) => item.productUuid)).toContain(
      "p-server",
    );
  });

  it("blocks a Match authoring of the same rule, which is why it is a Budget", () => {
    // Kept as a test rather than a comment: authored as Match, this rule fails a
    // device that plainly fits, because Match resolves both sides through option
    // ranks and two plain numbers have none. Somebody reading §6.2.5's "a Match
    // rule" and authoring it literally would ship a rule that blocks every rack
    // build, and it would look like a working rule.
    const asMatch = rule({
      uuid: "r-depth-match",
      name: "Device fits the rack (authored as Match)",
      family: "match",
      comparator: "lte",
      consumer: { source: "spec", specUuid: "a-depth" },
      provider: { source: "spec", specUuid: "a-usable-depth" },
    });
    expect(
      evaluateRelationship(asMatch, [rack, deepServer], context()).status,
    ).toBe("block");
  });

  it("says nothing when no rack is in the basket", () => {
    // A device with a depth and nothing to fit it into is not a violation. A
    // rule that fired here would block every loose NVR anyone ever bought.
    expect(
      evaluateRelationship(depthRule, [deepServer], context()).status,
    ).not.toBe("block");
  });

  it("reports UNKNOWN rather than passing when a depth is missing", () => {
    // The distinction the whole completeness model exists for: a device whose
    // depth nobody recorded has not been checked, and must not look like one
    // that fits.
    const undocumented: EngineItem = {
      productUuid: "p-mystery",
      name: "Undocumented NVR",
      quantity: 1,
      values: {},
      expects: ["a-depth"],
    };
    const finding = evaluateRelationship(
      depthRule,
      [shallowRack, undocumented],
      context(),
    );
    expect(finding.status).not.toBe("pass");
  });
});
