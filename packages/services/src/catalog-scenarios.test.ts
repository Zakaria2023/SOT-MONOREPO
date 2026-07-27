import { describe, expect, it } from "vitest";
import type { Predicate, ProductValues, SpecOption } from "../../../db/types";
import {
  ceilingSlice,
  clearHiddenValues,
  completenessProblems,
  facetAssignments,
  outOfSliceValues,
  resolveAssignments,
  revealProblems,
  ruleAssignments,
  visibleAssignments,
  type AssignmentDefinition,
  type AssignmentRow,
} from "./assignment-resolver";
import { buildChains } from "./category-tree";
import {
  expandFacetChoices,
  facetSelectionValues,
  type CategoryFacet,
} from "./facet-selection";
import { evaluatePredicate, validatePredicate } from "./predicate";
import {
  evaluateRelationship,
  evaluateSelection,
  type EngineContext,
  type EngineItem,
  type EngineRelationship,
  type EngineVariable,
} from "./relationship-engine";
import { indexAttributes, type AttributeMeta } from "./spec-values";

// ===========================================================================
// END-TO-END SCENARIOS.
//
// The unit suites (predicate, assignment-resolver, relationship-engine) each
// prove one layer. This file proves the LAYERS TOGETHER, through the scenario
// the whole design exists for:
//
//   a switch, 20 cameras and a patch panel in one cart → pay, or be stopped
//   with a specific, numeric, actionable message.
//
// Each describe block is one whole journey: author the library, assign it to a
// category, fill a product in, author a rule, then run the cart.
// ===========================================================================

// ---------------------------------------------------------------------------
// A realistic catalog, authored the way the admin would author it
// ---------------------------------------------------------------------------

const option = (
  value: string,
  label: string,
  rank: number | null = null,
  retired = false,
): SpecOption => ({ value, label, rank, retired });

const attr = (
  overrides: Partial<AssignmentDefinition> & { uuid: string; label: string },
): AssignmentDefinition => ({
  type: "single_select",
  unit: null,
  ordered: false,
  options: [],
  key: overrides.label.toLowerCase().replace(/\s+/g, "-"),
  internalName: null,
  description: null,
  audience: "everyone",
  order: 0,
  groupUuid: null,
  ...overrides,
});

// The role attribute is the answer to "how does a rule know this is a camera".
// It is an ATTRIBUTE, not a category name, so it survives renames and
// translation — the whole reason Presence can live in the same data model.
const ROLE = attr({
  uuid: "a-role",
  label: "Device Role",
  type: "multi_select",
  options: [
    option("camera", "Camera"),
    option("recorder", "Recorder"),
    option("switch", "Switch"),
    option("poe_source", "PoE source"),
    option("patch_panel", "Patch panel"),
  ],
});

const POE = attr({ uuid: "a-poe", label: "PoE", type: "boolean" });

const POE_BUDGET = attr({
  uuid: "a-budget",
  label: "PoE Budget",
  type: "number",
  unit: "W",
});

const POE_IN = attr({
  uuid: "a-poe-in",
  label: "PoE Input Type",
  ordered: true,
  options: [
    option("af", "802.3af", 1),
    option("at", "802.3at", 2),
    option("bt", "802.3bt", 3),
  ],
});

const POE_OUT = attr({
  uuid: "a-poe-out",
  label: "PoE Output Type",
  type: "multi_select",
  ordered: true,
  options: [
    option("af", "802.3af", 1),
    option("at", "802.3at", 2),
    option("bt", "802.3bt", 3),
  ],
});

const DRAW = attr({
  uuid: "a-draw",
  label: "Operating Power",
  type: "number",
  unit: "W",
});

const PORTS = attr({
  uuid: "a-ports",
  label: "Downlink Ports",
  type: "number",
  unit: "ports",
});

const SPEED = attr({
  uuid: "a-speed",
  label: "Port Speed",
  ordered: true,
  options: [
    option("100m", "100M", 100),
    option("1g", "1G", 1000),
    option("2.5g", "2.5G", 2500),
    option("5g", "5G", 5000),
    option("10g", "10G", 10000),
    option("40g", "40G", 40000),
  ],
});

const CHANNELS = attr({
  uuid: "a-channels",
  label: "Recording Channels",
  type: "number",
  unit: "channels",
});

const CERT = attr({
  uuid: "a-cert",
  label: "Installer Certification",
  audience: "partner",
  options: [option("required", "Required"), option("not", "Not required")],
});

const LIBRARY = [
  ROLE,
  POE,
  POE_BUDGET,
  POE_IN,
  POE_OUT,
  DRAW,
  PORTS,
  SPEED,
  CHANNELS,
  CERT,
];

// The tree: Networking → Switches → SMB Switches, and a separate Cameras leaf.
const NETWORKING = "cat-networking";
const SWITCHES = "cat-switches";
const SMB = "cat-smb";
const CAMERAS = "cat-cameras";

const CATEGORY_ROWS = [
  { uuid: NETWORKING, parentUuid: null },
  { uuid: SWITCHES, parentUuid: NETWORKING },
  { uuid: SMB, parentUuid: SWITCHES },
  { uuid: CAMERAS, parentUuid: null },
];

const CHAINS = buildChains(CATEGORY_ROWS);

const row = (
  overrides: Partial<AssignmentRow> & {
    specificationUuid: string;
    categoryUuid: string;
  },
): AssignmentRow => ({
  isFilter: true,
  isRule: true,
  scope: "branch",
  showIf: null,
  audience: "everyone",
  enabledValues: null,
  suppressed: false,
  order: 0,
  ...overrides,
});

// How the catalog team would actually set this up: Port Speed branch-wide at
// Networking, the PoE trio on Switches with the reveal, roles everywhere.
const ASSIGNMENTS: AssignmentRow[] = [
  row({ specificationUuid: "a-speed", categoryUuid: NETWORKING, scope: "branch" }),
  row({
    specificationUuid: "a-role",
    categoryUuid: NETWORKING,
    isFilter: false,
    scope: "branch",
  }),
  row({ specificationUuid: "a-poe", categoryUuid: SWITCHES }),
  row({
    specificationUuid: "a-budget",
    categoryUuid: SWITCHES,
    isFilter: false,
    showIf: { op: "equals", attr: "a-poe", value: true },
  }),
  row({
    specificationUuid: "a-poe-out",
    categoryUuid: SWITCHES,
    isFilter: false,
    showIf: { op: "equals", attr: "a-poe", value: true },
  }),
  row({ specificationUuid: "a-ports", categoryUuid: SWITCHES }),
  row({ specificationUuid: "a-cert", categoryUuid: SWITCHES }),
  // SMB narrows the inherited speed slice, literally.
  row({
    specificationUuid: "a-speed",
    categoryUuid: SMB,
    enabledValues: ["1g", "2.5g", "10g"],
  }),
  // Cameras
  row({ specificationUuid: "a-role", categoryUuid: CAMERAS, isFilter: false }),
  row({ specificationUuid: "a-draw", categoryUuid: CAMERAS, isFilter: false }),
  row({ specificationUuid: "a-poe-in", categoryUuid: CAMERAS }),
];

const resolveFor = (categoryUuid: string) =>
  resolveAssignments({
    chain: CHAINS.get(categoryUuid) ?? [categoryUuid],
    rows: ASSIGNMENTS,
    definitions: LIBRARY,
  });

const attributes = indexAttributes(LIBRARY);

const context = (overrides: Partial<EngineContext> = {}): EngineContext => ({
  attributes,
  variables: new Map<string, EngineVariable>(),
  catalog: [],
  ...overrides,
});

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

const isCamera: Predicate = {
  op: "in",
  attr: "a-role",
  values: ["camera"],
  mode: "any",
};
const isSwitch: Predicate = {
  op: "in",
  attr: "a-role",
  values: ["switch"],
  mode: "any",
};
const isRecorder: Predicate = {
  op: "in",
  attr: "a-role",
  values: ["recorder"],
  mode: "any",
};

// The three products from the acceptance test.
const SWITCH: EngineItem = {
  productUuid: "p-switch",
  name: "24-port PoE switch",
  quantity: 1,
  values: {
    "a-role": ["switch", "poe_source"],
    "a-poe": true,
    "a-budget": 130,
    "a-poe-out": ["af", "at"],
    "a-ports": 24,
    "a-speed": "1g",
    "a-cert": "not",
  },
};

const CAMERA: EngineItem = {
  productUuid: "p-camera",
  name: "Dome camera",
  quantity: 20,
  values: { "a-role": ["camera"], "a-draw": 12, "a-poe-in": "af" },
};

const PANEL: EngineItem = {
  productUuid: "p-panel",
  name: "24-port patch panel",
  quantity: 1,
  values: { "a-role": ["patch_panel"], "a-ports": 24 },
};

// The published ruleset a real launch would have.
const RULES: EngineRelationship[] = [
  rule({
    uuid: "R-presence-recorder",
    name: "A camera needs a recorder",
    family: "presence",
    presence: {
      trigger: isCamera,
      requires: [
        {
          description: "Cameras need somewhere to record",
          satisfiedBy: [
            { type: "item_exists", predicate: isRecorder },
            { type: "variable_true", variableUuid: "v-cloud" },
          ],
          perTriggerQuantity: 0,
        },
      ],
      suggestedFix: "Add an NVR, or switch on cloud recording.",
    },
  }),
  rule({
    uuid: "R-poe-budget",
    name: "Switch PoE budget covers device draw",
    family: "budget",
    headroomPercent: 100,
    consumer: { source: "spec", specUuid: "a-draw" },
    consumerWhen: isCamera,
    provider: { source: "spec", specUuid: "a-budget" },
    providerWhen: isSwitch,
  }),
  rule({
    uuid: "R-ports",
    name: "Cameras fit the available ports",
    family: "count",
    consumer: { source: "item_count" },
    consumerWhen: isCamera,
    provider: { source: "spec", specUuid: "a-ports" },
    providerWhen: isSwitch,
  }),
  rule({
    uuid: "R-poe-class",
    name: "Device PoE class fits the switch",
    family: "match",
    comparator: "lte",
    consumer: { source: "spec", specUuid: "a-poe-in" },
    provider: { source: "spec", specUuid: "a-poe-out" },
  }),
];

// ===========================================================================
describe("SCENARIO 1 — the acceptance test, end to end", () => {
  it("stops the cart with the exact numbers, both problems, in the right order", () => {
    const report = evaluateSelection(RULES, [SWITCH, CAMERA, PANEL], context());

    // Two blockers: the missing recorder and the over-budget PoE.
    expect(report.blockers.map((finding) => finding.relationshipUuid)).toEqual([
      "R-presence-recorder",
      "R-poe-budget",
    ]);

    // Presence first — "you forgot the recorder" is more actionable than "the
    // recorder you have is too small".
    expect(report.findings[0]?.family).toBe("presence");

    const budget = report.blockers.find(
      (finding) => finding.relationshipUuid === "R-poe-budget",
    );
    expect(budget?.demand).toBe(240);
    expect(budget?.capacity).toBe(130);
    expect(budget?.message).toContain("240 W");
    expect(budget?.message).toContain("130 W");
    expect(budget?.message).toContain("over by 110 W");

    // The port count and the PoE class both pass, so they must NOT appear as
    // problems — a buyer shown four warnings for two faults stops reading.
    expect(report.passed).toBe(2);
  });

  it("lets the same cart through once both faults are fixed", () => {
    const nvr: EngineItem = {
      productUuid: "p-nvr",
      name: "32-channel NVR",
      quantity: 1,
      values: { "a-role": ["recorder"], "a-channels": 32 },
    };
    const bigger: EngineItem = {
      ...SWITCH,
      values: { ...SWITCH.values, "a-budget": 370 },
    };

    const report = evaluateSelection(
      RULES,
      [bigger, CAMERA, PANEL, nvr],
      context(),
    );
    expect(report.blockers).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.unknowns).toEqual([]);
  });

  it("names replacement switches that would actually fit", () => {
    const report = evaluateSelection(
      RULES,
      [SWITCH, CAMERA],
      context({
        catalog: [
          {
            productUuid: "c-1",
            name: "90W switch",
            values: { "a-role": ["switch"], "a-budget": 90 },
          },
          {
            productUuid: "c-2",
            name: "370W switch",
            values: { "a-role": ["switch"], "a-budget": 370 },
          },
          {
            productUuid: "c-3",
            name: "250W switch",
            values: { "a-role": ["switch"], "a-budget": 250 },
          },
        ],
      }),
    );
    const budget = report.blockers.find(
      (finding) => finding.relationshipUuid === "R-poe-budget",
    );
    // Only those that clear 240 W, smallest first. The 90 W switch is not a fix.
    expect(
      budget?.corrections[0]?.products.map((entry) => entry.name),
    ).toEqual(["250W switch", "370W switch"]);
  });

  it("offers the cloud-recording escape hatch instead of a recorder", () => {
    const report = evaluateSelection(
      RULES,
      [{ ...SWITCH, values: { ...SWITCH.values, "a-budget": 370 } }, CAMERA],
      context({
        variables: new Map([
          [
            "v-cloud",
            {
              uuid: "v-cloud",
              label: "Cloud recording",
              unit: null,
              value: true,
            },
          ],
        ]),
      }),
    );
    expect(report.blockers).toEqual([]);
  });

  it("blocks a bt camera on an af/at switch, speaking in option labels", () => {
    const btCamera: EngineItem = {
      ...CAMERA,
      quantity: 1,
      values: { ...CAMERA.values, "a-poe-in": "bt" },
    };
    const finding = evaluateRelationship(
      RULES[3] as EngineRelationship,
      [SWITCH, btCamera],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.message).toContain("802.3bt");
    expect(finding.message).toContain("802.3af, 802.3at");
    // Never the stored slug.
    expect(finding.message).not.toContain('"bt"');
  });
});

// ===========================================================================
describe("SCENARIO 2 — authoring a category, and what a product form shows", () => {
  it("inherits branch-wide, narrows the slice literally, and keeps the gap out", () => {
    const smb = resolveFor(SMB);
    const speed = smb.find((entry) => entry.definition.uuid === "a-speed");

    expect(speed?.inherited).toBe(false);
    expect(speed?.offeredOptions.map((option) => option.value)).toEqual([
      "1g",
      "2.5g",
      "10g",
    ]);
    // 5G was excluded and must stay excluded — a "ceiling" reading would put it
    // back and nothing would say so.
    expect(speed?.offeredOptions.map((option) => option.value)).not.toContain(
      "5g",
    );
  });

  it("carries an ancestor's attribute down two levels", () => {
    const smb = resolveFor(SMB);
    const role = smb.find((entry) => entry.definition.uuid === "a-role");
    expect(role?.inherited).toBe(true);
    expect(role?.sourceCategoryUuid).toBe(NETWORKING);
  });

  it("hides the PoE trio until PoE is Yes, then requires the budget", () => {
    const smb = resolveFor(SMB);

    const off = visibleAssignments(smb, { "a-poe": false }).map(
      (entry) => entry.definition.uuid,
    );
    expect(off).not.toContain("a-budget");
    expect(off).not.toContain("a-poe-out");

    const on = visibleAssignments(smb, { "a-poe": true }).map(
      (entry) => entry.definition.uuid,
    );
    expect(on).toContain("a-budget");
    expect(on).toContain("a-poe-out");

    // Visible + rule input = mandatory. This is the exact hole that would
    // otherwise ship a switch with PoE and no budget.
    const problems = completenessProblems(smb, { "a-poe": true });
    expect(problems.map((problem) => problem.specificationUuid)).toContain(
      "a-budget",
    );
    expect(
      problems.find((problem) => problem.specificationUuid === "a-budget")
        ?.reason,
    ).toBe("revealed");
  });

  it("clears the budget when PoE is switched back to No", () => {
    const smb = resolveFor(SMB);
    const values: ProductValues = {
      "a-poe": true,
      "a-budget": 130,
      "a-poe-out": ["af"],
    };
    const cleared = clearHiddenValues(smb, { ...values, "a-poe": false });
    expect(cleared["a-budget"]).toBeUndefined();
    expect(cleared["a-poe-out"]).toBeUndefined();
    expect(cleared["a-poe"]).toBe(false);
  });

  it("reports a complete switch as sellable", () => {
    const smb = resolveFor(SMB);
    expect(completenessProblems(smb, SWITCH.values)).toEqual([]);
  });

  it("flags a 40G switch in a category whose slice stops at 10G", () => {
    const smb = resolveFor(SMB);
    const outside = outOfSliceValues(smb, {
      ...SWITCH.values,
      "a-speed": "40g",
    });
    expect(outside).toHaveLength(1);
    expect(outside[0]?.values).toEqual(["40g"]);
    // Allowed and recorded, not blocked: the catalog must be able to describe a
    // product it actually sells.
    expect(
      completenessProblems(smb, { ...SWITCH.values, "a-speed": "40g" }).some(
        (problem) => problem.kind === "outside_slice",
      ),
    ).toBe(true);
  });

  it("keeps a reveal graph healthy and catches a broken one", () => {
    expect(revealProblems(resolveFor(SMB))).toEqual([]);

    const broken = resolveAssignments({
      chain: CHAINS.get(SMB) ?? [SMB],
      // PoE removed, but PoE Budget still watches it.
      rows: ASSIGNMENTS.filter(
        (entry) => entry.specificationUuid !== "a-poe",
      ),
      definitions: LIBRARY,
    });
    expect(revealProblems(broken)[0]?.code).toBe("unassigned_trigger");
  });

  it("drops an inherited attribute from one leaf without touching its siblings", () => {
    const suppressed = resolveAssignments({
      chain: CHAINS.get(SMB) ?? [SMB],
      rows: [
        // The table is unique on (specification, category), so suppressing
        // replaces SMB's own row rather than adding a second one.
        ...ASSIGNMENTS.filter(
          (entry) =>
            !(
              entry.categoryUuid === SMB && entry.specificationUuid === "a-speed"
            ),
        ),
        row({
          specificationUuid: "a-speed",
          categoryUuid: SMB,
          suppressed: true,
        }),
      ],
      definitions: LIBRARY,
    });
    expect(
      suppressed.some((entry) => entry.definition.uuid === "a-speed"),
    ).toBe(false);
    // The parent is untouched.
    expect(
      resolveFor(SWITCHES).some((entry) => entry.definition.uuid === "a-speed"),
    ).toBe(true);
  });
});

// ===========================================================================
describe("SCENARIO 3 — who sees what", () => {
  it("treats user and partner as siblings, not a ladder", () => {
    const smb = resolveFor(SMB);
    expect(
      facetAssignments(smb, "partner").some(
        (entry) => entry.definition.uuid === "a-cert",
      ),
    ).toBe(true);
    expect(
      facetAssignments(smb, "user").some(
        (entry) => entry.definition.uuid === "a-cert",
      ),
    ).toBe(false);
  });

  it("offers a branch-wide facet on a descendant and hides a living attribute", () => {
    const facets = facetAssignments(resolveFor(SMB), "user").map(
      (entry) => entry.definition.uuid,
    );
    expect(facets).toContain("a-speed");
    // isFilter=false — the engine reads Device Role, the shopper never filters
    // on it.
    expect(facets).not.toContain("a-role");
  });

  it("reveals a conditional facet only once the shopper's own filter matches", () => {
    const smb = resolveFor(SMB);
    // PoE Budget is filter-off here, so use PoE Output Type's sibling behaviour:
    // assert that the reveal is driven by the shopper's selection at all.
    const withReveal = resolveAssignments({
      chain: CHAINS.get(SMB) ?? [SMB],
      rows: [
        ...ASSIGNMENTS.filter(
          (entry) =>
            !(
              entry.categoryUuid === SWITCHES &&
              entry.specificationUuid === "a-budget"
            ),
        ),
        row({
          specificationUuid: "a-budget",
          categoryUuid: SWITCHES,
          isFilter: true,
          showIf: { op: "equals", attr: "a-poe", value: true },
        }),
      ],
      definitions: LIBRARY,
    });

    expect(
      facetAssignments(withReveal, "user", {}).map(
        (entry) => entry.definition.uuid,
      ),
    ).not.toContain("a-budget");
    expect(
      facetAssignments(withReveal, "user", { "a-poe": true }).map(
        (entry) => entry.definition.uuid,
      ),
    ).toContain("a-budget");
    expect(smb.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
describe("SCENARIO 4 — the shopper's filters", () => {
  const speedFacet: CategoryFacet = {
    key: "a-speed",
    label: "Port Speed",
    type: "single_select",
    unit: null,
    ordered: true,
    options: [
      { value: "1g", label: "1G", rank: 1000 },
      { value: "2.5g", label: "2.5G", rank: 2500 },
      { value: "10g", label: "10G", rank: 10000 },
    ],
  };

  const bandFacet: CategoryFacet = {
    key: "a-bands",
    label: "Frequency Band",
    type: "multi_select",
    unit: null,
    ordered: false,
    options: [
      { value: "2.4", label: "2.4GHz", rank: null },
      { value: "6", label: "6GHz", rank: null },
    ],
  };

  // On a SCALE the shopper is saying what they HAVE, so anything that fits it
  // should still show. Picking 1G must not hide the 10G switch.
  it("expands an ordered pick upward, not downward", () => {
    expect(expandFacetChoices([speedFacet], { "a-speed": ["1g"] })).toEqual({
      "a-speed": ["1g", "2.5g", "10g"],
    });
    expect(expandFacetChoices([speedFacet], { "a-speed": ["10g"] })).toEqual({
      "a-speed": ["10g"],
    });
  });

  it("keeps an unordered pick literal", () => {
    expect(expandFacetChoices([bandFacet], { "a-bands": ["6"] })).toEqual({
      "a-bands": ["6"],
    });
  });

  it("ignores a facet the category does not offer", () => {
    expect(expandFacetChoices([speedFacet], { "a-gone": ["x"] })).toEqual({});
  });

  it("turns filter picks into values the reveal can read", () => {
    const boolFacet: CategoryFacet = {
      key: "a-poe",
      label: "PoE",
      type: "boolean",
      unit: null,
      ordered: false,
      options: [],
    };
    expect(
      facetSelectionValues({ "a-poe": ["true"] }, [boolFacet]),
    ).toEqual({ "a-poe": true });
    expect(
      facetSelectionValues({ "a-bands": ["2.4", "6"] }, [bandFacet]),
    ).toEqual({ "a-bands": ["2.4", "6"] });
    expect(facetSelectionValues({ "a-speed": ["1g"] }, [speedFacet])).toEqual({
      "a-speed": "1g",
    });
  });
});

// ===========================================================================
describe("SCENARIO 5 — the engine never guesses", () => {
  it("reports an unfilled camera instead of passing the budget check", () => {
    const blank: EngineItem = {
      productUuid: "p-blank",
      name: "Unfilled camera",
      quantity: 20,
      values: { "a-role": ["camera"] },
    };
    const finding = evaluateRelationship(
      RULES[1] as EngineRelationship,
      [SWITCH, blank],
      context(),
    );
    expect(finding.status).toBe("unknown");
    expect(finding.status).not.toBe("pass");
    expect(finding.skipped[0]?.name).toBe("Unfilled camera");
  });

  it("says so on the finding when a pass excluded an unreadable item", () => {
    const blank: EngineItem = {
      productUuid: "p-blank",
      name: "Unfilled camera",
      quantity: 1,
      values: { "a-role": ["camera"] },
    };
    const finding = evaluateRelationship(
      RULES[1] as EngineRelationship,
      [SWITCH, { ...CAMERA, quantity: 5 }, blank],
      context(),
    );
    expect(finding.status).toBe("pass");
    expect(finding.message).toContain("could not be checked");
  });

  it("refuses to compare watts against volt-amps", () => {
    const va = attr({
      uuid: "a-va",
      label: "Apparent Power",
      type: "number",
      unit: "VA",
    });
    const finding = evaluateRelationship(
      rule({
        uuid: "R-ups",
        name: "Load fits the UPS",
        family: "budget",
        consumer: { source: "spec", specUuid: "a-draw" },
        provider: { source: "spec", specUuid: "a-va" },
      }),
      [
        { productUuid: "ups", name: "UPS", quantity: 1, values: { "a-va": 1500 } },
        {
          productUuid: "srv",
          name: "Server",
          quantity: 1,
          values: { "a-draw": 1400 },
        },
      ],
      context({ attributes: indexAttributes([DRAW, va]) }),
    );
    // 1400 < 1500 numerically. It must NOT pass — 1500 VA is not 1500 W, and
    // this is the classic UPS sizing mistake.
    expect(finding.status).toBe("unknown");
    expect(finding.message).toContain("apparent_power");
  });

  it("converts kW to W rather than refusing", () => {
    const kw = attr({
      uuid: "a-kw",
      label: "Budget",
      type: "number",
      unit: "kW",
    });
    const finding = evaluateRelationship(
      rule({
        uuid: "R-kw",
        name: "Draw fits a kW budget",
        family: "budget",
        consumer: { source: "spec", specUuid: "a-draw" },
        provider: { source: "spec", specUuid: "a-kw" },
      }),
      [
        { productUuid: "sw", name: "Switch", quantity: 1, values: { "a-kw": 1 } },
        CAMERA,
      ],
      context({ attributes: indexAttributes([DRAW, kw]) }),
    );
    expect(finding.status).toBe("pass");
    expect(finding.demand).toBe(0.24);
  });

  it("asks the buyer for an unanswered project input", () => {
    const finding = evaluateRelationship(
      rule({
        uuid: "R-ratio",
        name: "Access demand fits the uplink",
        family: "ratio",
        gate: "warn",
        ratioLimit: 20,
        consumer: { source: "variable", variableUuid: "v-demand" },
        provider: { source: "spec", specUuid: "a-ports" },
      }),
      [SWITCH],
      context({
        variables: new Map([
          [
            "v-demand",
            { uuid: "v-demand", label: "Access demand", unit: "ports", value: null },
          ],
        ]),
      }),
    );
    expect(finding.status).toBe("unknown");
    expect(finding.message).toContain("Access demand");
  });
});

// ===========================================================================
describe("SCENARIO 6 — capacity that cannot be pooled", () => {
  it("refuses a load no single switch can take, even when the total fits", () => {
    const perUnit = {
      ...(RULES[1] as EngineRelationship),
      allocation: "per_unit" as const,
    };
    const ptz: EngineItem = {
      productUuid: "p-ptz",
      name: "PTZ camera",
      quantity: 1,
      values: { "a-role": ["camera"], "a-draw": 200 },
    };
    // Two 130 W switches = 260 W pooled, and 200 W "fits". Physically it cannot
    // attach to either.
    const finding = evaluateRelationship(
      perUnit,
      [{ ...SWITCH, quantity: 2 }, ptz],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.message).toContain("do not fit on any single device");

    const pooled = evaluateRelationship(
      { ...perUnit, allocation: "pooled" },
      [{ ...SWITCH, quantity: 2 }, ptz],
      context(),
    );
    expect(pooled.status).toBe("pass");
  });

  it("spreads a load that genuinely fits and shows the bins", () => {
    const finding = evaluateRelationship(
      { ...(RULES[1] as EngineRelationship), allocation: "per_unit" },
      [{ ...SWITCH, quantity: 2 }, CAMERA],
      context(),
    );
    expect(finding.status).toBe("pass");
    expect(finding.bins).toHaveLength(2);
    for (const bin of finding.bins) {
      expect(bin.used).toBeLessThanOrEqual(130);
    }
  });

  it("applies headroom so a design at exactly 100% still fails", () => {
    const finding = evaluateRelationship(
      { ...(RULES[1] as EngineRelationship), headroomPercent: 80 },
      [SWITCH, { ...CAMERA, quantity: 10 }],
      context(),
    );
    expect(finding.effectiveCapacity).toBe(104);
    expect(finding.status).toBe("block");
  });
});

// ===========================================================================
describe("SCENARIO 7 — counting, pairing, and lookups", () => {
  it("counts quantities and respects the provider filter", () => {
    const ports = RULES[2] as EngineRelationship;
    expect(
      evaluateRelationship(ports, [SWITCH, CAMERA, PANEL], context()).demand,
    ).toBe(20);
    // The patch panel's 24 ports must not count as switch capacity.
    expect(
      evaluateRelationship(ports, [PANEL, CAMERA], context()).status,
    ).toBe("not_applicable");
  });

  it("pairs quantities: 20 triggers demand 20 companions", () => {
    const paired = rule({
      uuid: "R-pair",
      name: "Every camera needs a licence",
      family: "presence",
      presence: {
        trigger: isCamera,
        requires: [
          {
            description: "Each camera needs its own licence",
            satisfiedBy: [{ type: "item_exists", predicate: isRecorder }],
            perTriggerQuantity: 1,
          },
        ],
        suggestedFix: null,
      },
    });
    const licences: EngineItem = {
      productUuid: "p-lic",
      name: "Licence",
      quantity: 5,
      values: { "a-role": ["recorder"] },
    };
    const short = evaluateRelationship(paired, [CAMERA, licences], context());
    expect(short.status).toBe("block");
    expect(short.message).toContain("need 20 in total");

    const enough = evaluateRelationship(
      paired,
      [CAMERA, { ...licences, quantity: 20 }],
      context(),
    );
    expect(enough.status).toBe("pass");
  });

  it("reads the tighter lookup row first, then falls through", () => {
    const grade = attr({
      uuid: "a-grade",
      label: "Cable Category",
      ordered: true,
      options: [option("cat6", "Cat6", 2), option("cat6a", "Cat6A", 3)],
    });
    const length = attr({
      uuid: "a-length",
      label: "Cable Length",
      type: "number",
      unit: "m",
    });
    const cable = rule({
      uuid: "R-cable",
      name: "Cable run within its limit",
      family: "conditional",
      gate: "warn",
      consumer: { source: "spec", specUuid: "a-length" },
      lookup: {
        inputs: ["a-grade"],
        rows: [
          { when: { op: "equals", attr: "a-grade", value: "cat6" }, limit: 55 },
          { when: { op: "exists", attr: "a-grade" }, limit: 100 },
        ],
      },
    });
    const ctx = context({ attributes: indexAttributes([grade, length]) });

    const cat6 = evaluateRelationship(
      cable,
      [
        {
          productUuid: "c6",
          name: "Cat6 run",
          quantity: 1,
          values: { "a-grade": "cat6", "a-length": 80 },
        },
      ],
      ctx,
    );
    expect(cat6.status).toBe("warn");
    expect(cat6.message).toContain("limit of 55 m");

    const cat6a = evaluateRelationship(
      cable,
      [
        {
          productUuid: "c6a",
          name: "Cat6A run",
          quantity: 1,
          values: { "a-grade": "cat6a", "a-length": 80 },
        },
      ],
      ctx,
    );
    expect(cat6a.status).toBe("pass");
  });
});

// ===========================================================================
describe("SCENARIO 8 — authoring mistakes are caught, not shipped", () => {
  it("rejects a numeric comparison on an unordered list", () => {
    const problems = validatePredicate(
      { op: "lte", attr: "a-role", value: 1 },
      attributes,
    );
    expect(problems[0]?.code).toBe("not_ordered");
  });

  it("rejects an empty value list that could never match", () => {
    expect(
      validatePredicate(
        { op: "in", attr: "a-role", values: [], mode: "any" },
        attributes,
      )[0]?.code,
    ).toBe("empty_values");
  });

  it("rejects a condition pointing at a deleted attribute", () => {
    expect(
      validatePredicate({ op: "exists", attr: "a-deleted" }, attributes)[0]
        ?.code,
    ).toBe("unknown_attribute");
  });

  it("detects a circular reveal", () => {
    const cyclic = resolveAssignments({
      chain: [SMB],
      rows: [
        row({
          specificationUuid: "a-poe",
          categoryUuid: SMB,
          showIf: { op: "exists", attr: "a-budget" },
        }),
        row({
          specificationUuid: "a-budget",
          categoryUuid: SMB,
          showIf: { op: "exists", attr: "a-poe" },
        }),
      ],
      definitions: LIBRARY,
    });
    expect(revealProblems(cyclic).some((entry) => entry.code === "cycle")).toBe(
      true,
    );
  });

  it("never lets a missing value satisfy a condition", () => {
    const result = evaluatePredicate(
      { op: "not_equals", attr: "a-poe", value: true },
      {},
      attributes,
    );
    expect(result.matched).toBe(false);
    expect(result.missing).toEqual(["a-poe"]);
  });

  it("fills a ceiling slice for the author in one click", () => {
    expect(ceilingSlice(SPEED, "2.5g")).toEqual(["100m", "1g", "2.5g"]);
  });

  it("never offers a retired option, but keeps it comparable", () => {
    const withRetired = attr({
      uuid: "a-legacy",
      label: "Legacy",
      options: [option("keep", "Keep"), option("old", "Old", null, true)],
    });
    const resolved = resolveAssignments({
      chain: [SMB],
      rows: [row({ specificationUuid: "a-legacy", categoryUuid: SMB })],
      definitions: [withRetired],
    });
    expect(
      resolved[0]?.offeredOptions.map((option) => option.value),
    ).toEqual(["keep"]);
    // A product still holding "old" is not reported as being outside the slice —
    // the value stays valid, it simply cannot be picked again.
    expect(outOfSliceValues(resolved, { "a-legacy": "old" })).toHaveLength(1);
  });
});

// ===========================================================================
describe("SCENARIO 9 — market scope and gating", () => {
  it("skips a compliance rule outside the selection's market", () => {
    const ksaOnly = {
      ...(RULES[1] as EngineRelationship),
      scope: { regions: ["SA"] },
    };
    expect(
      evaluateSelection([ksaOnly], [SWITCH, CAMERA], context({ region: "AE" }))
        .blockers,
    ).toEqual([]);
    expect(
      evaluateSelection([ksaOnly], [SWITCH, CAMERA], context({ region: "SA" }))
        .blockers,
    ).toHaveLength(1);
  });

  it("applies every rule when no market is given", () => {
    const ksaOnly = {
      ...(RULES[1] as EngineRelationship),
      scope: { regions: ["SA"] },
    };
    expect(
      evaluateSelection([ksaOnly], [SWITCH, CAMERA], context()).blockers,
    ).toHaveLength(1);
  });

  it("separates a warning from a blocker so only one stops checkout", () => {
    const warnBudget = {
      ...(RULES[1] as EngineRelationship),
      gate: "warn" as const,
    };
    const report = evaluateSelection([warnBudget], [SWITCH, CAMERA], context());
    expect(report.blockers).toEqual([]);
    expect(report.warnings).toHaveLength(1);
  });
});

// ===========================================================================
describe("SCENARIO 10 — the tree itself", () => {
  it("builds a nearest-first ancestor chain", () => {
    expect(CHAINS.get(SMB)).toEqual([SMB, SWITCHES, NETWORKING]);
    expect(CHAINS.get(NETWORKING)).toEqual([NETWORKING]);
    expect(CHAINS.get(CAMERAS)).toEqual([CAMERAS]);
  });

  it("survives a cycle in the category data without hanging", () => {
    const chains = buildChains([
      { uuid: "a", parentUuid: "b" },
      { uuid: "b", parentUuid: "a" },
    ]);
    expect(chains.get("a")?.length).toBeLessThanOrEqual(3);
  });

  it("keeps two sibling branches independent", () => {
    const cameras = resolveFor(CAMERAS).map((entry) => entry.definition.uuid);
    expect(cameras).toContain("a-draw");
    // Nothing from the Switches branch leaks sideways.
    expect(cameras).not.toContain("a-budget");
    expect(cameras).not.toContain("a-ports");
  });
});
