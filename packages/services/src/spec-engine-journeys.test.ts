import { describe, expect, it } from "vitest";
import {
  predicateCategories,
  type Predicate,
  type ProductValues,
  type SpecOption,
} from "../../../db/types";
import {
  clearHiddenValues,
  completenessProblems,
  facetAssignments,
  resolveAssignments,
  revealProblems,
  visibleAssignments,
  type AssignmentDefinition,
  type AssignmentRow,
} from "./assignment-resolver";
import { buildChains } from "./category-tree";
import { evaluatePredicate } from "./predicate";
import {
  evaluateRelationship,
  evaluateSelection,
  type EngineContext,
  type EngineItem,
  type EngineRelationship,
  type EngineVariable,
} from "./relationship-engine";
import { describeValue, indexAttributes } from "./spec-values";

// ===========================================================================
// JOURNEYS FOR EVERYTHING ADDED IN THE REBUILD OF THE AUTHORING SURFACES.
//
// The other suites each prove one layer, and `catalog-scenarios` proves the
// original acceptance story. This file proves the things the simplified admin
// now writes actually work when a cart runs into them:
//
//   J1  a number answered as a RANGE, from library flag to blocked cart
//   J2  a PRODUCT GROUP as the subject of a rule, across a branch
//   J3  a rule with NO side filter, and how a blank is still caught
//   J4  the exact shapes each of the six family forms produces
//   J5  the reveal, end to end — form, storage, completeness, storefront
//   J6  a whole cart, with every family at once
//
// Every fixture below is written the way the ADMIN would write it, so a change
// that breaks one of these breaks something an author can actually do.
// ===========================================================================

// ---------------------------------------------------------------------------
// The catalog: a small ELV shop, authored as the admin would
// ---------------------------------------------------------------------------

const NETWORKING = "cat-networking";
const SWITCHES = "cat-switches";
const SOHO = "cat-soho";
const CAMERAS = "cat-cameras";
const RECORDERS = "cat-recorders";
const CABLES = "cat-cables";

const TREE = [
  { uuid: NETWORKING, parentUuid: null },
  { uuid: SWITCHES, parentUuid: NETWORKING },
  { uuid: SOHO, parentUuid: SWITCHES },
  { uuid: CAMERAS, parentUuid: null },
  { uuid: RECORDERS, parentUuid: null },
  { uuid: CABLES, parentUuid: null },
];
const CHAINS = buildChains(TREE);

const option = (
  value: string,
  label: string,
  rank: number | null = null,
): SpecOption => ({ value, label, rank, retired: false });

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
  allowRange: false,
  order: 0,
  groupUuid: null,
  ...overrides,
});

const POE = attr({ uuid: "a-poe", label: "PoE", type: "boolean" });

const BUDGET = attr({
  uuid: "a-budget",
  label: "PoE Budget",
  type: "number",
  unit: "W",
});

const DRAW = attr({
  uuid: "a-draw",
  label: "Operating Power",
  type: "number",
  unit: "W",
  // The rebuild's headline addition: a draw that varies with the heater on.
  allowRange: true,
});

const TEMPERATURE = attr({
  uuid: "a-temp",
  label: "Operating Temperature",
  type: "number",
  unit: "°C",
  allowRange: true,
});

const PORTS = attr({
  uuid: "a-ports",
  label: "Downlink Ports",
  type: "number",
});

const POE_CLASS = attr({
  uuid: "a-poe-class",
  label: "PoE Class",
  type: "single_select",
  ordered: true,
  options: [
    option("af", "802.3af", 1),
    option("at", "802.3at", 2),
    option("bt", "802.3bt", 3),
  ],
});

// The switch's side of the same scale. Two attributes, not one: a match rule
// compares what the CAMERA needs against what the SWITCH offers, and one shared
// attribute would leave the engine unable to tell the sides apart.
const POE_OUT = attr({
  uuid: "a-poe-out",
  label: "PoE Output Class",
  type: "single_select",
  ordered: true,
  options: [
    option("af", "802.3af", 1),
    option("at", "802.3at", 2),
    option("bt", "802.3bt", 3),
  ],
});

const GRADE = attr({
  uuid: "a-grade",
  label: "Cable Grade",
  type: "single_select",
  options: [option("cat6", "Cat6"), option("cat6a", "Cat6A")],
});

const SPEED = attr({
  uuid: "a-speed",
  label: "Link Speed",
  type: "single_select",
  ordered: true,
  options: [option("1g", "1G", 1), option("10g", "10G", 2)],
});

const LENGTH = attr({
  uuid: "a-length",
  label: "Run Length",
  type: "number",
  unit: "m",
});

const DEFINITIONS = [
  POE,
  BUDGET,
  DRAW,
  TEMPERATURE,
  PORTS,
  POE_CLASS,
  POE_OUT,
  GRADE,
  SPEED,
  LENGTH,
];

const ATTRIBUTES = indexAttributes(DEFINITIONS);

const assignment = (
  overrides: Partial<AssignmentRow> & {
    categoryUuid: string;
    specificationUuid: string;
  },
): AssignmentRow => ({
  isFilter: false,
  isRule: true,
  scope: "branch",
  showIf: null,
  audience: "everyone",
  enabledValues: null,
  suppressed: false,
  order: 0,
  ...overrides,
});

// Switches carry PoE, and the budget only shows once PoE is Yes — the reveal
// the admin authors as "PoE is Yes" in the condition picker.
const ASSIGNMENTS: AssignmentRow[] = [
  assignment({
    categoryUuid: SWITCHES,
    specificationUuid: POE.uuid,
    isFilter: true,
  }),
  assignment({
    categoryUuid: SWITCHES,
    specificationUuid: BUDGET.uuid,
    showIf: { op: "equals", attr: POE.uuid, value: true },
  }),
  assignment({ categoryUuid: SWITCHES, specificationUuid: PORTS.uuid }),
  assignment({ categoryUuid: SWITCHES, specificationUuid: POE_OUT.uuid }),
  assignment({ categoryUuid: CAMERAS, specificationUuid: DRAW.uuid }),
  assignment({
    categoryUuid: CAMERAS,
    specificationUuid: POE_CLASS.uuid,
    isFilter: true,
  }),
  assignment({ categoryUuid: CAMERAS, specificationUuid: TEMPERATURE.uuid }),
  assignment({ categoryUuid: CABLES, specificationUuid: GRADE.uuid }),
  assignment({ categoryUuid: CABLES, specificationUuid: SPEED.uuid }),
  assignment({ categoryUuid: CABLES, specificationUuid: LENGTH.uuid }),
];

const resolve = (categoryUuid: string) =>
  resolveAssignments({
    chain: CHAINS.get(categoryUuid) ?? [categoryUuid],
    rows: ASSIGNMENTS,
    definitions: DEFINITIONS,
  });

/** What `loadSelection` builds for one cart line — the same shape, by hand. */
const item = (
  overrides: Partial<EngineItem> & {
    productUuid: string;
    name: string;
    categoryUuid: string;
  },
): EngineItem => {
  const { categoryUuid, ...rest } = overrides;
  return {
    quantity: 1,
    values: {},
    // Exactly what loadSelection derives: the chain from the model, and the
    // attributes this category marks as read by the engine.
    categoryChain: CHAINS.get(categoryUuid) ?? [categoryUuid],
    expects: resolve(categoryUuid)
      .filter((entry) => entry.isRule)
      .map((entry) => entry.definition.uuid),
    ...rest,
  };
};

const context = (overrides: Partial<EngineContext> = {}): EngineContext => ({
  attributes: ATTRIBUTES,
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

// The cart used throughout.
const poeSwitch = item({
  productUuid: "p-switch",
  name: "8-port PoE switch",
  categoryUuid: SOHO,
  values: {
    [POE.uuid]: true,
    [BUDGET.uuid]: 130,
    [PORTS.uuid]: 8,
    [POE_OUT.uuid]: "at",
  },
});

const varifocalCamera = item({
  productUuid: "p-camera",
  name: "Varifocal dome",
  categoryUuid: CAMERAS,
  quantity: 6,
  values: {
    // 4 W idle, 12 W with the IR illuminator on.
    [DRAW.uuid]: { min: 4, max: 12 },
    [POE_CLASS.uuid]: "af",
    [TEMPERATURE.uuid]: { min: -20, max: 60 },
  },
});

// ===========================================================================
describe("J1 — a number answered as a range, library to blocked cart", () => {
  const budgetRule = rule({
    uuid: "r-budget",
    name: "PoE budget covers device draw",
    family: "budget",
    consumer: { source: "spec", specUuid: DRAW.uuid },
    provider: { source: "spec", specUuid: BUDGET.uuid },
  });

  it("the library says the attribute is a range", () => {
    expect(DRAW.allowRange).toBe(true);
    expect(BUDGET.allowRange).toBe(false);
  });

  it("costs the cart its worst case, not its best", () => {
    const finding = evaluateRelationship(
      budgetRule,
      [poeSwitch, varifocalCamera],
      context(),
    );
    // 6 × 12 W = 72. Reading the low end would give 24 and understate it by 3x.
    expect(finding.demand).toBe(72);
    expect(finding.status).toBe("pass");
  });

  it("blocks once the worst case stops fitting", () => {
    const finding = evaluateRelationship(
      budgetRule,
      [poeSwitch, { ...varifocalCamera, quantity: 11 }],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.demand).toBe(132);
    expect(finding.message).toContain("132");
    expect(finding.message).toContain("130");
  });

  it("promises only the guaranteed end of a supplying range", () => {
    const rangeSwitch = {
      ...poeSwitch,
      values: { ...poeSwitch.values, [BUDGET.uuid]: { min: 120, max: 130 } },
    };
    const finding = evaluateRelationship(
      budgetRule,
      [rangeSwitch, { ...varifocalCamera, quantity: 10 }],
      context(),
    );
    // 120 W promised against 120 W drawn. Reading 130 would approve a switch
    // that only sometimes copes.
    expect(finding.capacity).toBe(120);
    expect(finding.status).toBe("pass");

    const overrun = evaluateRelationship(
      budgetRule,
      [rangeSwitch, { ...varifocalCamera, quantity: 11 }],
      context(),
    );
    expect(overrun.status).toBe("block");
  });

  it("reads a range condition against the end that could break it", () => {
    const outdoors: Predicate = {
      op: "lte",
      attr: TEMPERATURE.uuid,
      value: 40,
    };
    const arctic: Predicate = { op: "gte", attr: TEMPERATURE.uuid, value: -40 };
    // −20 to 60 is not "at most 40" just because one end of it is.
    expect(
      evaluatePredicate(outdoors, varifocalCamera.values, ATTRIBUTES).matched,
    ).toBe(false);
    expect(
      evaluatePredicate(arctic, varifocalCamera.values, ATTRIBUTES).matched,
    ).toBe(true);
  });

  it("renders both ends wherever a value is shown", () => {
    expect(describeValue({ min: 4, max: 12 }, DRAW)).toBe("4 to 12 W");
    expect(describeValue(12, BUDGET)).toBe("12 W");
  });

  it("counts a half-filled range as still needed, never as answered", () => {
    const halfFilled = {
      [DRAW.uuid]: { min: 4 } as unknown as number,
      [POE_CLASS.uuid]: "af",
      [TEMPERATURE.uuid]: { min: -20, max: 60 },
    };
    const problems = completenessProblems(resolve(CAMERAS), halfFilled);
    expect(problems.map((problem) => problem.label)).toContain(
      "Operating Power",
    );
  });
});

// ===========================================================================
describe("J2 — a product group as the subject of a rule", () => {
  // What the Count form writes: item_count filtered to a group.
  const portsRule = rule({
    uuid: "r-ports",
    name: "Cameras fit the available ports",
    family: "count",
    consumer: { source: "item_count" },
    consumerWhen: { op: "in_category", categoryUuid: CAMERAS },
    provider: { source: "spec", specUuid: PORTS.uuid },
  });

  it("counts the group and nothing else", () => {
    const finding = evaluateRelationship(
      portsRule,
      [poeSwitch, varifocalCamera],
      context(),
    );
    expect(finding.demand).toBe(6);
    expect(finding.capacity).toBe(8);
    expect(finding.status).toBe("pass");
  });

  it("blocks when the group overruns, and says both numbers", () => {
    const finding = evaluateRelationship(
      portsRule,
      [poeSwitch, { ...varifocalCamera, quantity: 12 }],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.message).toContain("12");
    expect(finding.message).toContain("8");
  });

  it("reaches down a branch: a rule about Networking finds a SOHO switch", () => {
    const branchScoped = {
      ...portsRule,
      providerWhen: {
        op: "in_category" as const,
        categoryUuid: NETWORKING,
      },
    };
    // The switch is filed under SOHO → Switches → Networking.
    expect(poeSwitch.categoryChain).toEqual([SOHO, SWITCHES, NETWORKING]);
    const finding = evaluateRelationship(
      branchScoped,
      [poeSwitch, varifocalCamera],
      context(),
    );
    expect(finding.capacity).toBe(8);
  });

  it("does not reach sideways into a sibling branch", () => {
    const wrongBranch = {
      ...portsRule,
      consumerWhen: { op: "in_category" as const, categoryUuid: RECORDERS },
    };
    const finding = evaluateRelationship(
      wrongBranch,
      [poeSwitch, varifocalCamera],
      context(),
    );
    expect(finding.status).toBe("not_applicable");
  });

  it("never matches for a caller with no tree — a form applying a reveal", () => {
    // The product form evaluates reveals with values only. A group condition
    // must read as "does not apply", never as a silent yes.
    expect(
      evaluatePredicate(
        { op: "in_category", categoryUuid: CAMERAS },
        varifocalCamera.values,
        ATTRIBUTES,
      ).matched,
    ).toBe(false);
  });
});

// ===========================================================================
describe("J3 — a rule with no side filter still catches a blank", () => {
  // Exactly what the simplified builder writes: two attributes, nothing else.
  const plain = rule({
    uuid: "r-plain",
    name: "PoE budget covers device draw",
    family: "budget",
    consumer: { source: "spec", specUuid: DRAW.uuid },
    provider: { source: "spec", specUuid: BUDGET.uuid },
  });

  it("finds both sides from the attributes alone", () => {
    const finding = evaluateRelationship(
      plain,
      [poeSwitch, varifocalCamera],
      context(),
    );
    expect(finding.consumers).toHaveLength(1);
    expect(finding.providers).toHaveLength(1);
  });

  it("reports a camera whose category owed a draw and has none", () => {
    const unfilled = item({
      productUuid: "p-unfilled",
      name: "Unfilled camera",
      categoryUuid: CAMERAS,
      quantity: 4,
      values: { [POE_CLASS.uuid]: "af" },
    });
    // Its category marks Operating Power as read by the engine.
    expect(unfilled.expects).toContain(DRAW.uuid);

    const finding = evaluateRelationship(
      plain,
      [poeSwitch, unfilled],
      context(),
    );
    expect(finding.status).toBe("unknown");
    expect(finding.skipped.map((entry) => entry.name)).toContain(
      "Unfilled camera",
    );
  });

  it("leaves alone an item whose category never owed the attribute", () => {
    const cable = item({
      productUuid: "p-cable",
      name: "Cat6 patch lead",
      categoryUuid: CABLES,
      values: { [GRADE.uuid]: "cat6", [SPEED.uuid]: "1g", [LENGTH.uuid]: 3 },
    });
    expect(cable.expects).not.toContain(DRAW.uuid);

    const finding = evaluateRelationship(
      plain,
      [poeSwitch, varifocalCamera, cable],
      context(),
    );
    expect(finding.status).toBe("pass");
    expect(finding.skipped).toEqual([]);
  });
});

// ===========================================================================
describe("J4 — the shape each family form produces", () => {
  it("budget: capacity, consumer, headroom", () => {
    const withHeadroom = rule({
      uuid: "r-b",
      name: "Budget with headroom",
      family: "budget",
      consumer: { source: "spec", specUuid: DRAW.uuid },
      provider: { source: "spec", specUuid: BUDGET.uuid },
      headroomPercent: 80,
    });
    const finding = evaluateRelationship(
      withHeadroom,
      [poeSwitch, { ...varifocalCamera, quantity: 9 }],
      context(),
    );
    // 130 × 80% = 104 usable, against 9 × 12 = 108.
    expect(finding.effectiveCapacity).toBe(104);
    expect(finding.status).toBe("block");
  });

  it("count: item_count over a group, against a limit attribute", () => {
    const counted = rule({
      uuid: "r-c",
      name: "Cameras fit the ports",
      family: "count",
      consumer: { source: "item_count" },
      consumerWhen: { op: "in_category", categoryUuid: CAMERAS },
      provider: { source: "spec", specUuid: PORTS.uuid },
    });
    const finding = evaluateRelationship(
      counted,
      [poeSwitch, varifocalCamera],
      context(),
    );
    // Counted as items, so the message talks about items and not watts.
    expect(finding.unit).toBeNull();
    expect(finding.demand).toBe(6);
  });

  it("match: what the camera needs against what the switch offers", () => {
    const classFits = rule({
      uuid: "r-m",
      name: "Camera PoE class fits the switch",
      family: "match",
      comparator: "lte",
      consumer: { source: "spec", specUuid: POE_CLASS.uuid },
      provider: { source: "spec", specUuid: POE_OUT.uuid },
    });

    // An af camera on an at switch is fine — the ordered scale is what decides,
    // and af ranks below at.
    expect(
      evaluateRelationship(classFits, [poeSwitch, varifocalCamera], context())
        .status,
    ).toBe("pass");

    const btCamera = {
      ...varifocalCamera,
      values: { ...varifocalCamera.values, [POE_CLASS.uuid]: "bt" },
    };
    expect(
      evaluateRelationship(classFits, [poeSwitch, btCamera], context()).status,
    ).toBe("block");
  });

  it("ratio: demand over supply, against a target", () => {
    const contention = rule({
      uuid: "r-r",
      name: "Access demand within uplink contention",
      family: "ratio",
      gate: "warn",
      ratioLimit: 4,
      consumer: { source: "spec", specUuid: DRAW.uuid },
      provider: { source: "spec", specUuid: BUDGET.uuid },
    });
    // 6 × 12 = 72 against 130 → 0.55:1, well inside 4:1.
    expect(
      evaluateRelationship(contention, [poeSwitch, varifocalCamera], context())
        .status,
    ).toBe("pass");

    const heavy = evaluateRelationship(
      contention,
      [poeSwitch, { ...varifocalCamera, quantity: 60 }],
      context(),
    );
    // 720 ÷ 130 = 5.5:1 — over target, and only a warning by design.
    expect(heavy.status).toBe("warn");
  });

  it("presence: a group triggers, a group satisfies", () => {
    const needsRecorder = rule({
      uuid: "r-p",
      name: "Cameras need somewhere to record",
      family: "presence",
      presence: {
        trigger: { op: "in_category", categoryUuid: CAMERAS },
        requires: [
          {
            description: "",
            satisfiedBy: [
              {
                type: "item_exists",
                predicate: { op: "in_category", categoryUuid: RECORDERS },
              },
            ],
            perTriggerQuantity: 0,
          },
        ],
        suggestedFix: null,
      },
    });

    expect(
      evaluateRelationship(
        needsRecorder,
        [poeSwitch, varifocalCamera],
        context(),
      ).status,
    ).toBe("block");

    const nvr = item({
      productUuid: "p-nvr",
      name: "8-channel NVR",
      categoryUuid: RECORDERS,
    });
    expect(
      evaluateRelationship(
        needsRecorder,
        [poeSwitch, varifocalCamera, nvr],
        context(),
      ).status,
    ).toBe("pass");
  });

  it("conditional: the limit comes from the item's own other values", () => {
    // What the if / and / then form writes — two rows, most specific first.
    const runLength = rule({
      uuid: "r-cond",
      name: "Run length within the cable's rated distance",
      family: "conditional",
      consumer: { source: "spec", specUuid: LENGTH.uuid },
      lookup: {
        inputs: [],
        rows: [
          {
            when: {
              op: "all",
              children: [
                { op: "in", attr: GRADE.uuid, values: ["cat6"], mode: "any" },
                { op: "in", attr: SPEED.uuid, values: ["10g"], mode: "any" },
              ],
            },
            limit: 55,
          },
          {
            when: {
              op: "all",
              children: [
                { op: "in", attr: GRADE.uuid, values: ["cat6a"], mode: "any" },
                { op: "in", attr: SPEED.uuid, values: ["10g"], mode: "any" },
              ],
            },
            limit: 100,
          },
        ],
      },
    });

    const cable = (grade: string, length: number) =>
      item({
        productUuid: `p-${grade}-${length}`,
        name: `${grade} ${length} m`,
        categoryUuid: CABLES,
        values: {
          [GRADE.uuid]: grade,
          [SPEED.uuid]: "10g",
          [LENGTH.uuid]: length,
        },
      });

    // The SAME 80 m run passes as Cat6A and fails as Cat6 — which is the whole
    // reason this family exists.
    expect(
      evaluateRelationship(runLength, [cable("cat6a", 80)], context()).status,
    ).toBe("pass");
    expect(
      evaluateRelationship(runLength, [cable("cat6", 80)], context()).status,
    ).toBe("block");
  });
});

// ===========================================================================
describe("J5 — the reveal, from the form to the storefront", () => {
  const resolved = resolve(SWITCHES);

  it("hides the budget until PoE is Yes", () => {
    const off = visibleAssignments(resolved, { [POE.uuid]: false });
    expect(off.map((entry) => entry.definition.uuid)).not.toContain(
      BUDGET.uuid,
    );

    const on = visibleAssignments(resolved, { [POE.uuid]: true });
    expect(on.map((entry) => entry.definition.uuid)).toContain(BUDGET.uuid);
  });

  it("clears a budget left behind when PoE goes back to No", () => {
    const stale: ProductValues = { [POE.uuid]: false, [BUDGET.uuid]: 130 };
    const cleaned = clearHiddenValues(resolved, stale);
    // A leftover 130 W on a non-PoE switch would size a rule off a number that
    // no longer applies.
    expect(cleaned[BUDGET.uuid]).toBeUndefined();
  });

  it("requires the budget only while it is revealed", () => {
    // Everything the category asks for EXCEPT the budget, which is hidden.
    const complete: ProductValues = {
      [POE.uuid]: false,
      [PORTS.uuid]: 8,
      [POE_OUT.uuid]: "at",
    };
    expect(completenessProblems(resolved, complete)).toEqual([]);

    const revealed = completenessProblems(resolved, {
      ...complete,
      [POE.uuid]: true,
    });
    expect(revealed.map((problem) => problem.label)).toEqual(["PoE Budget"]);
    expect(revealed[0]?.reason).toBe("revealed");
  });

  it("shows the same facet to a shopper only once they tick PoE", () => {
    // The storefront runs the reveal on the shopper's own filter state, which is
    // why a PoE Budget facet does not sit on a page of non-PoE switches.
    const before = facetAssignments(resolved, "user", {});
    expect(before.map((entry) => entry.definition.uuid)).not.toContain(
      BUDGET.uuid,
    );
  });

  it("inherits the whole set down to a leaf", () => {
    const leaf = resolve(SOHO).map((entry) => entry.definition.uuid);
    expect(leaf).toContain(POE.uuid);
    expect(leaf).toContain(PORTS.uuid);
  });
});

// ===========================================================================
describe("J6 — one cart, every family at once", () => {
  const rules: EngineRelationship[] = [
    rule({
      uuid: "r-presence",
      name: "Cameras need somewhere to record",
      family: "presence",
      presence: {
        trigger: { op: "in_category", categoryUuid: CAMERAS },
        requires: [
          {
            description: "",
            satisfiedBy: [
              {
                type: "item_exists",
                predicate: { op: "in_category", categoryUuid: RECORDERS },
              },
            ],
            perTriggerQuantity: 0,
          },
        ],
        suggestedFix: null,
      },
    }),
    rule({
      uuid: "r-budget",
      name: "PoE budget covers device draw",
      family: "budget",
      consumer: { source: "spec", specUuid: DRAW.uuid },
      provider: { source: "spec", specUuid: BUDGET.uuid },
    }),
    rule({
      uuid: "r-ports",
      name: "Cameras fit the available ports",
      family: "count",
      consumer: { source: "item_count" },
      consumerWhen: { op: "in_category", categoryUuid: CAMERAS },
      provider: { source: "spec", specUuid: PORTS.uuid },
    }),
  ];

  const nvr = item({
    productUuid: "p-nvr",
    name: "8-channel NVR",
    categoryUuid: RECORDERS,
  });

  it("passes a design that holds together", () => {
    const report = evaluateSelection(
      rules,
      [poeSwitch, varifocalCamera, nvr],
      context(),
    );
    expect(report.blockers).toEqual([]);
    expect(report.unknowns).toEqual([]);
    expect(report.passed).toBe(3);
  });

  it("blocks on the specific thing that broke, not on everything", () => {
    const report = evaluateSelection(
      rules,
      // 12 cameras: over the 8 ports, still inside the 130 W budget (144 W is
      // not — so both capacity rules fail and the recorder rule still passes).
      [poeSwitch, { ...varifocalCamera, quantity: 12 }, nvr],
      context(),
    );
    const broken = report.blockers.map((finding) => finding.name);
    expect(broken).toContain("Cameras fit the available ports");
    expect(broken).not.toContain("Cameras need somewhere to record");
  });

  it("reports a missing recorder once, not as a conflict too", () => {
    const report = evaluateSelection(
      rules,
      [poeSwitch, varifocalCamera],
      context(),
    );
    // Presence owns "what is missing"; the capacity families own "what
    // conflicts". A cart with no recorder produces exactly one finding.
    expect(report.blockers).toHaveLength(1);
    expect(report.blockers[0]?.family).toBe("presence");
  });

  it("surfaces an unrunnable check as unknown, never as a pass", () => {
    const unfilled = item({
      productUuid: "p-unfilled",
      name: "Unfilled camera",
      categoryUuid: CAMERAS,
      quantity: 2,
      values: { [POE_CLASS.uuid]: "af" },
    });
    const report = evaluateSelection(
      rules,
      [poeSwitch, unfilled, nvr],
      context(),
    );
    expect(report.unknowns.map((finding) => finding.name)).toContain(
      "PoE budget covers device draw",
    );
    // And it is NOT counted among the checks that passed.
    expect(report.passed).toBeLessThan(3);
  });
});

// ===========================================================================
describe("J7 — the gaps an author could otherwise fall into", () => {
  it("refuses a product group as a reveal trigger", () => {
    // A reveal is evaluated by the product FORM, against values only. It has no
    // cart and no tree, so a group condition reads false forever and the field
    // never appears — with nothing on screen to say why.
    const rows: AssignmentRow[] = [
      ...ASSIGNMENTS,
      assignment({
        categoryUuid: SWITCHES,
        specificationUuid: POE_CLASS.uuid,
        showIf: { op: "in_category", categoryUuid: CAMERAS },
      }),
    ];
    const resolved = resolveAssignments({
      chain: CHAINS.get(SWITCHES) ?? [SWITCHES],
      rows,
      definitions: DEFINITIONS,
    });
    const problems = revealProblems(resolved);
    expect(problems.map((problem) => problem.code)).toContain(
      "group_in_reveal",
    );
  });

  it("finds a group buried inside an and/or reveal too", () => {
    const rows: AssignmentRow[] = [
      ...ASSIGNMENTS,
      assignment({
        categoryUuid: SWITCHES,
        specificationUuid: POE_CLASS.uuid,
        showIf: {
          op: "all",
          children: [
            { op: "equals", attr: POE.uuid, value: true },
            { op: "in_category", categoryUuid: CAMERAS },
          ],
        },
      }),
    ];
    const resolved = resolveAssignments({
      chain: CHAINS.get(SWITCHES) ?? [SWITCHES],
      rows,
      definitions: DEFINITIONS,
    });
    expect(revealProblems(resolved).map((problem) => problem.code)).toContain(
      "group_in_reveal",
    );
  });

  it("leaves an ordinary value reveal alone", () => {
    // The PoE → PoE Budget reveal every switch category uses.
    expect(revealProblems(resolve(SWITCHES))).toEqual([]);
  });

  it("collects every group a rule names, however deeply nested", () => {
    const buried: Predicate = {
      op: "any",
      children: [
        { op: "in_category", categoryUuid: CAMERAS },
        {
          op: "not",
          child: { op: "in_category", categoryUuid: RECORDERS },
        },
        { op: "equals", attr: POE.uuid, value: true },
      ],
    };
    expect(predicateCategories(buried).sort()).toEqual(
      [CAMERAS, RECORDERS].sort(),
    );
    // And an attribute-only condition names none, so the deleted-category check
    // never fires on a rule that has no groups in it.
    expect(
      predicateCategories({ op: "equals", attr: POE.uuid, value: true }),
    ).toEqual([]);
  });

  it("a rule pointing at a deleted group matches nothing", () => {
    // The behaviour the validator exists to warn about, proven at the engine
    // level: it does not throw, it does not half-apply — it simply never fires.
    const orphaned = rule({
      uuid: "r-orphan",
      name: "Counts a group that was deleted",
      family: "count",
      consumer: { source: "item_count" },
      consumerWhen: { op: "in_category", categoryUuid: "cat-deleted" },
      provider: { source: "spec", specUuid: PORTS.uuid },
    });
    const finding = evaluateRelationship(
      orphaned,
      [poeSwitch, varifocalCamera],
      context(),
    );
    expect(finding.status).toBe("not_applicable");
  });
});

// ===========================================================================
describe("J8 — a typed number in a condition", () => {
  // A number attribute has no option list, so its value is TYPED. What the form
  // stores has to be a number, not the string that was typed: `in` compares by
  // way of String(), which works on "55" and stops working on "55.0".
  it("matches a number stored as a number", () => {
    const exactly55: Predicate = { op: "equals", attr: LENGTH.uuid, value: 55 };
    expect(
      evaluatePredicate(exactly55, { [LENGTH.uuid]: 55 }, ATTRIBUTES).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(exactly55, { [LENGTH.uuid]: 56 }, ATTRIBUTES).matched,
    ).toBe(false);
  });

  it("matches the same number however it was written", () => {
    // 55.0 typed into the box becomes 55, so it still finds a 55 m run. Stored
    // as the string "55.0" this comparison would silently fail.
    const written: Predicate = {
      op: "equals",
      attr: LENGTH.uuid,
      value: Number("55.0"),
    };
    expect(
      evaluatePredicate(written, { [LENGTH.uuid]: 55 }, ATTRIBUTES).matched,
    ).toBe(true);
  });

  it("drives a lookup row keyed on a number", () => {
    const byLength = rule({
      uuid: "r-num-lookup",
      name: "Short runs may go faster",
      family: "conditional",
      consumer: { source: "spec", specUuid: LENGTH.uuid },
      lookup: {
        inputs: [],
        rows: [
          {
            // if Cable Grade = Cat6 and Link Speed = 10G, then at most 55 m.
            when: {
              op: "all",
              children: [
                { op: "in", attr: GRADE.uuid, values: ["cat6"], mode: "any" },
                { op: "in", attr: SPEED.uuid, values: ["10g"], mode: "any" },
              ],
            },
            limit: 55,
          },
        ],
      },
    });

    const run = (length: number) =>
      evaluateRelationship(
        byLength,
        [
          item({
            productUuid: `p-run-${length}`,
            name: `${length} m run`,
            categoryUuid: CABLES,
            values: {
              [GRADE.uuid]: "cat6",
              [SPEED.uuid]: "10g",
              [LENGTH.uuid]: length,
            },
          }),
        ],
        context(),
      );

    expect(run(50).status).toBe("pass");
    expect(run(55).status).toBe("pass");
    expect(run(60).status).toBe("block");
  });

  it("treats a boolean condition as a real boolean", () => {
    const isPoe: Predicate = { op: "equals", attr: POE.uuid, value: true };
    expect(
      evaluatePredicate(isPoe, { [POE.uuid]: true }, ATTRIBUTES).matched,
    ).toBe(true);
    expect(
      evaluatePredicate(isPoe, { [POE.uuid]: false }, ATTRIBUTES).matched,
    ).toBe(false);
  });
});
