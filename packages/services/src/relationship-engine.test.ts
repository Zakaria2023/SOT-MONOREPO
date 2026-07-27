import { describe, expect, it } from "vitest";
import {
  evaluateRelationship,
  evaluateSelection,
  type EngineContext,
  type EngineItem,
  type EngineRelationship,
  type EngineVariable,
} from "./relationship-engine";
import { indexAttributes, type AttributeMeta } from "./spec-values";

// ---------------------------------------------------------------------------
// The library used throughout. This is the acceptance scenario from the design
// doc: a switch, some cameras, and a patch panel in one cart.
// ---------------------------------------------------------------------------

const draw: AttributeMeta = {
  uuid: "a-draw",
  label: "Operating Power",
  type: "number",
  unit: "W",
  ordered: true,
  options: [],
};

const budget: AttributeMeta = {
  uuid: "a-budget",
  label: "PoE Budget",
  type: "number",
  unit: "W",
  ordered: true,
  options: [],
};

const budgetKw: AttributeMeta = {
  uuid: "a-budget-kw",
  label: "PoE Budget (kW)",
  type: "number",
  unit: "kW",
  ordered: true,
  options: [],
};

const ports: AttributeMeta = {
  uuid: "a-ports",
  label: "Downlink Ports",
  type: "number",
  unit: "ports",
  ordered: true,
  options: [],
};

const poeIn: AttributeMeta = {
  uuid: "a-poe-in",
  label: "PoE Input Type",
  type: "single_select",
  unit: null,
  ordered: true,
  options: [
    { value: "af", label: "802.3af", rank: 1, retired: false },
    { value: "at", label: "802.3at", rank: 2, retired: false },
    { value: "bt", label: "802.3bt", rank: 3, retired: false },
  ],
};

const poeOut: AttributeMeta = {
  uuid: "a-poe-out",
  label: "PoE Output Type",
  type: "multi_select",
  unit: null,
  ordered: true,
  options: [
    { value: "af", label: "802.3af", rank: 1, retired: false },
    { value: "at", label: "802.3at", rank: 2, retired: false },
    { value: "bt", label: "802.3bt", rank: 3, retired: false },
  ],
};

const role: AttributeMeta = {
  uuid: "a-role",
  label: "Device Role",
  type: "multi_select",
  unit: null,
  ordered: false,
  options: [
    { value: "camera", label: "Camera", rank: null, retired: false },
    { value: "recorder", label: "Recorder", rank: null, retired: false },
    { value: "switch", label: "Switch", rank: null, retired: false },
    { value: "poe_source", label: "PoE source", rank: null, retired: false },
    { value: "patch_panel", label: "Patch panel", rank: null, retired: false },
  ],
};

const cableGrade: AttributeMeta = {
  uuid: "a-grade",
  label: "Cable Category",
  type: "single_select",
  unit: null,
  ordered: true,
  options: [
    { value: "cat5e", label: "Cat5e", rank: 1, retired: false },
    { value: "cat6", label: "Cat6", rank: 2, retired: false },
    { value: "cat6a", label: "Cat6A", rank: 3, retired: false },
  ],
};

const linkSpeed: AttributeMeta = {
  uuid: "a-link",
  label: "Link Speed",
  type: "single_select",
  unit: null,
  ordered: true,
  options: [
    { value: "1g", label: "1G", rank: 1000, retired: false },
    { value: "10g", label: "10G", rank: 10000, retired: false },
  ],
};

const cableLength: AttributeMeta = {
  uuid: "a-length",
  label: "Cable Length",
  type: "number",
  unit: "m",
  ordered: true,
  options: [],
};

const channels: AttributeMeta = {
  uuid: "a-channels",
  label: "Recording Channels",
  type: "number",
  unit: "channels",
  ordered: true,
  options: [],
};

const attributes = indexAttributes([
  draw,
  budget,
  budgetKw,
  ports,
  poeIn,
  poeOut,
  role,
  cableGrade,
  linkSpeed,
  cableLength,
  channels,
]);

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

// The cart from the acceptance test.
const switch24: EngineItem = {
  productUuid: "p-switch",
  name: "24-port PoE switch",
  quantity: 1,
  values: {
    "a-role": ["switch", "poe_source"],
    "a-budget": 130,
    "a-ports": 24,
    "a-poe-out": ["af", "at"],
  },
};

const camera: EngineItem = {
  productUuid: "p-camera",
  name: "Dome camera",
  quantity: 20,
  values: {
    "a-role": ["camera"],
    "a-draw": 12,
    "a-poe-in": "af",
  },
};

const patchPanel: EngineItem = {
  productUuid: "p-panel",
  name: "24-port patch panel",
  quantity: 1,
  values: { "a-role": ["patch_panel"], "a-ports": 24 },
};

const poeBudgetRule = rule({
  uuid: "r-budget",
  name: "Switch PoE budget covers device draw",
  family: "budget",
  consumer: { source: "spec", specUuid: "a-draw" },
  provider: { source: "spec", specUuid: "a-budget" },
});

describe("Budget — the acceptance scenario", () => {
  // 20 cameras × 12 W = 240 W against a 130 W budget: over by 110 W. This is the
  // exact message the whole design exists to produce.
  it("blocks the cart and names both numbers and the gap", () => {
    const finding = evaluateRelationship(
      poeBudgetRule,
      [switch24, camera, patchPanel],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.demand).toBe(240);
    expect(finding.capacity).toBe(130);
    expect(finding.message).toContain("240 W");
    expect(finding.message).toContain("130 W");
    expect(finding.message).toContain("over by 110 W");
  });

  it("passes once the draw fits", () => {
    const finding = evaluateRelationship(
      poeBudgetRule,
      [switch24, { ...camera, quantity: 10 }],
      context(),
    );
    expect(finding.status).toBe("pass");
    expect(finding.demand).toBe(120);
  });

  it("offers both an add-supply and a reduce-demand correction", () => {
    const finding = evaluateRelationship(
      poeBudgetRule,
      [switch24, camera],
      context(),
    );
    expect(finding.corrections.map((fix) => fix.shape)).toEqual([
      "add_supply",
      "reduce_demand",
    ]);
  });

  it("suggests catalog switches that would actually fit, smallest first", () => {
    const finding = evaluateRelationship(
      poeBudgetRule,
      [switch24, camera],
      context({
        catalog: [
          {
            productUuid: "c-1",
            name: "370W switch",
            values: { "a-budget": 370 },
          },
          {
            productUuid: "c-2",
            name: "250W switch",
            values: { "a-budget": 250 },
          },
          {
            productUuid: "c-3",
            name: "90W switch",
            values: { "a-budget": 90 },
          },
        ],
      }),
    );
    const suggested = finding.corrections[0]?.products.map((p) => p.name);
    expect(suggested).toEqual(["250W switch", "370W switch"]);
  });

  it("applies headroom, so a design at exactly 100% still fails", () => {
    const withHeadroom = { ...poeBudgetRule, headroomPercent: 80 };
    const finding = evaluateRelationship(
      withHeadroom,
      [switch24, { ...camera, quantity: 10 }],
      context(),
    );
    // 120 W demand against 130 × 80% = 104 W usable.
    expect(finding.status).toBe("block");
    expect(finding.effectiveCapacity).toBe(104);
  });

  it("multiplies capacity by the provider quantity when pooled", () => {
    const finding = evaluateRelationship(
      poeBudgetRule,
      [{ ...switch24, quantity: 2 }, camera],
      context(),
    );
    expect(finding.capacity).toBe(260);
    expect(finding.status).toBe("pass");
  });
});

describe("Budget — per-unit allocation", () => {
  const perUnit = { ...poeBudgetRule, allocation: "per_unit" as const };

  // Q29: two switches with 130 W each are NOT one switch with 260 W.
  it("refuses a design where no single device can take the load", () => {
    const bigCamera: EngineItem = {
      productUuid: "p-big",
      name: "PTZ camera",
      quantity: 1,
      values: { "a-role": ["camera"], "a-draw": 200 },
    };
    const finding = evaluateRelationship(
      perUnit,
      [{ ...switch24, quantity: 2 }, bigCamera],
      context(),
    );
    // Pooled, 200 W fits inside 260 W. Per unit, it fits neither switch.
    expect(finding.status).toBe("block");
    expect(finding.message).toContain("do not fit on any single device");
  });

  it("spreads a load that does fit across the units", () => {
    const finding = evaluateRelationship(
      perUnit,
      [
        { ...switch24, quantity: 2 },
        { ...camera, quantity: 20 },
      ],
      context(),
    );
    expect(finding.status).toBe("pass");
    expect(finding.bins).toHaveLength(2);
    expect(finding.bins[0]?.used).toBeLessThanOrEqual(130);
    expect(finding.bins[1]?.used).toBeLessThanOrEqual(130);
  });
});

describe("Budget — per-item mode", () => {
  // Q26: the per-item threshold is a MODE on Budget, not a seventh family.
  it("judges each unit against the best single provider value", () => {
    const perPort = rule({
      uuid: "r-per-port",
      name: "Camera draw fits one port",
      family: "budget",
      perItem: true,
      consumer: { source: "spec", specUuid: "a-draw" },
      provider: { source: "spec", specUuid: "a-budget" },
    });
    const hungry: EngineItem = {
      productUuid: "p-hungry",
      name: "Heater camera",
      quantity: 1,
      values: { "a-draw": 140 },
    };
    const finding = evaluateRelationship(
      perPort,
      [switch24, hungry],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.message).toContain("per-device limit");
  });
});

describe("Count", () => {
  // "20 cameras need 20 ports" — an item_count consumer, no attribute needed on
  // the camera at all.
  const portCount = rule({
    uuid: "r-ports",
    name: "Cameras fit the available ports",
    family: "count",
    consumer: { source: "item_count" },
    consumerWhen: { op: "in", attr: "a-role", values: ["camera"], mode: "any" },
    provider: { source: "spec", specUuid: "a-ports" },
    providerWhen: { op: "in", attr: "a-role", values: ["switch"], mode: "any" },
  });

  it("counts quantities, not line items", () => {
    const finding = evaluateRelationship(
      portCount,
      [switch24, camera, patchPanel],
      context(),
    );
    expect(finding.demand).toBe(20);
    expect(finding.capacity).toBe(24);
    expect(finding.status).toBe("pass");
  });

  it("blocks when the count exceeds the slots", () => {
    const finding = evaluateRelationship(
      portCount,
      [switch24, { ...camera, quantity: 30 }],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.demand).toBe(30);
  });

  // The provider filter is what stops the patch panel's 24 ports being counted
  // as switch capacity.
  it("respects the provider-side filter", () => {
    const finding = evaluateRelationship(
      portCount,
      [camera, patchPanel],
      context(),
    );
    expect(finding.status).toBe("not_applicable");
  });

  it("sums capacity across recorders", () => {
    const channelRule = rule({
      uuid: "r-ch",
      name: "Cameras fit the recorder channels",
      family: "count",
      consumer: { source: "item_count" },
      consumerWhen: {
        op: "in",
        attr: "a-role",
        values: ["camera"],
        mode: "any",
      },
      provider: { source: "spec", specUuid: "a-channels" },
    });
    const nvr: EngineItem = {
      productUuid: "p-nvr",
      name: "16-channel NVR",
      quantity: 2,
      values: { "a-role": ["recorder"], "a-channels": 16 },
    };
    const finding = evaluateRelationship(
      channelRule,
      [nvr, { ...camera, quantity: 30 }],
      context(),
    );
    expect(finding.capacity).toBe(32);
    expect(finding.status).toBe("pass");
  });
});

describe("Match", () => {
  const poeClass = rule({
    uuid: "r-class",
    name: "Device PoE class fits the switch",
    family: "match",
    comparator: "lte",
    consumer: { source: "spec", specUuid: "a-poe-in" },
    provider: { source: "spec", specUuid: "a-poe-out" },
  });

  it("passes an af device on an af/at switch", () => {
    expect(
      evaluateRelationship(poeClass, [switch24, camera], context()).status,
    ).toBe("pass");
  });

  it("blocks a bt device on an af/at switch", () => {
    const btCamera = {
      ...camera,
      quantity: 1,
      values: { ...camera.values, "a-poe-in": "bt" },
    };
    const finding = evaluateRelationship(
      poeClass,
      [switch24, btCamera],
      context(),
    );
    expect(finding.status).toBe("block");
    // The message speaks in option LABELS, not stored values.
    expect(finding.message).toContain("802.3bt");
    expect(finding.message).toContain("802.3af, 802.3at");
  });

  it("overlaps two sets with intersects", () => {
    const profiles: AttributeMeta = {
      uuid: "a-onvif",
      label: "ONVIF Profiles",
      type: "multi_select",
      unit: null,
      ordered: false,
      options: [
        { value: "s", label: "S", rank: null, retired: false },
        { value: "g", label: "G", rank: null, retired: false },
        { value: "t", label: "T", rank: null, retired: false },
      ],
    };
    // Q33: the same attribute on both sides is legal and common.
    const onvif = rule({
      uuid: "r-onvif",
      name: "Camera and recorder share a profile",
      family: "match",
      comparator: "intersects",
      gate: "warn",
      consumer: { source: "spec", specUuid: "a-onvif" },
      consumerWhen: {
        op: "in",
        attr: "a-role",
        values: ["camera"],
        mode: "any",
      },
      provider: { source: "spec", specUuid: "a-onvif" },
      providerWhen: {
        op: "in",
        attr: "a-role",
        values: ["recorder"],
        mode: "any",
      },
    });
    const ctx = context({
      attributes: indexAttributes([role, profiles]),
    });

    const overlapping = evaluateRelationship(
      onvif,
      [
        {
          productUuid: "c",
          name: "Camera",
          quantity: 1,
          values: { "a-role": ["camera"], "a-onvif": ["s", "t"] },
        },
        {
          productUuid: "r",
          name: "NVR",
          quantity: 1,
          values: { "a-role": ["recorder"], "a-onvif": ["s", "g"] },
        },
      ],
      ctx,
    );
    expect(overlapping.status).toBe("pass");

    const disjoint = evaluateRelationship(
      onvif,
      [
        {
          productUuid: "c",
          name: "Camera",
          quantity: 1,
          values: { "a-role": ["camera"], "a-onvif": ["t"] },
        },
        {
          productUuid: "r",
          name: "NVR",
          quantity: 1,
          values: { "a-role": ["recorder"], "a-onvif": ["g"] },
        },
      ],
      ctx,
    );
    // The rule only warns, so it must not block.
    expect(disjoint.status).toBe("warn");
  });

  it("degrades a scale comparison on an unordered list to membership", () => {
    const unordered: AttributeMeta = {
      uuid: "a-iface",
      label: "Reader Interface",
      type: "single_select",
      unit: null,
      ordered: false,
      options: [
        { value: "wiegand", label: "Wiegand", rank: null, retired: false },
        { value: "osdp", label: "OSDP", rank: null, retired: false },
      ],
    };
    const ifaces: AttributeMeta = {
      ...unordered,
      uuid: "a-ifaces",
      type: "multi_select",
    };
    const readerRule = rule({
      uuid: "r-reader",
      name: "Reader interface fits the controller",
      family: "match",
      comparator: "lte",
      consumer: { source: "spec", specUuid: "a-iface" },
      provider: { source: "spec", specUuid: "a-ifaces" },
    });
    const ctx = context({ attributes: indexAttributes([unordered, ifaces]) });

    expect(
      evaluateRelationship(
        readerRule,
        [
          {
            productUuid: "r",
            name: "Reader",
            quantity: 1,
            values: { "a-iface": "osdp" },
          },
          {
            productUuid: "c",
            name: "Controller",
            quantity: 1,
            values: { "a-ifaces": ["osdp", "wiegand"] },
          },
        ],
        ctx,
      ).status,
    ).toBe("pass");

    expect(
      evaluateRelationship(
        readerRule,
        [
          {
            productUuid: "r",
            name: "Reader",
            quantity: 1,
            values: { "a-iface": "osdp" },
          },
          {
            productUuid: "c",
            name: "Controller",
            quantity: 1,
            values: { "a-ifaces": ["wiegand"] },
          },
        ],
        ctx,
      ).status,
    ).toBe("block");
  });
});

describe("Ratio", () => {
  const uplink = rule({
    uuid: "r-uplink",
    name: "Access demand fits the uplink",
    family: "ratio",
    gate: "warn",
    ratioLimit: 20,
    consumer: { source: "variable", variableUuid: "v-demand" },
    provider: { source: "spec", specUuid: "a-ports" },
  });

  const withDemand = (value: number | null): EngineContext =>
    context({
      variables: new Map([
        [
          "v-demand",
          { uuid: "v-demand", label: "Access demand", unit: "ports", value },
        ],
      ]),
    });

  it("passes within the target contention", () => {
    const finding = evaluateRelationship(uplink, [switch24], withDemand(400));
    // 400 ÷ 24 = 16.67:1, inside 20:1.
    expect(finding.status).toBe("pass");
  });

  it("warns above the target contention", () => {
    const finding = evaluateRelationship(uplink, [switch24], withDemand(600));
    expect(finding.status).toBe("warn");
    expect(finding.message).toContain("25:1");
  });

  // Q37: an unanswered project input means the rule does not run — and the
  // message asks the buyer the question instead of going quiet.
  it("asks for an unanswered project input instead of guessing", () => {
    const finding = evaluateRelationship(uplink, [switch24], withDemand(null));
    expect(finding.status).toBe("unknown");
    expect(finding.message).toContain("Access demand");
  });
});

describe("Conditional", () => {
  const cableRun = rule({
    uuid: "r-cable",
    name: "Cable run within the limit for its grade and speed",
    family: "conditional",
    gate: "warn",
    consumer: { source: "spec", specUuid: "a-length" },
    lookup: {
      inputs: ["a-grade", "a-link"],
      rows: [
        {
          // Cat6 at 10G is the specific case, listed above the catch-all.
          when: {
            op: "all",
            children: [
              { op: "equals", attr: "a-grade", value: "cat6" },
              { op: "equals", attr: "a-link", value: "10g" },
            ],
          },
          limit: 55,
        },
        { when: { op: "exists", attr: "a-grade" }, limit: 100 },
      ],
    },
  });

  it("reads the tighter limit for the specific combination", () => {
    const finding = evaluateRelationship(
      cableRun,
      [
        {
          productUuid: "p-cable",
          name: "Cat6 run",
          quantity: 1,
          values: { "a-grade": "cat6", "a-link": "10g", "a-length": 80 },
        },
      ],
      context(),
    );
    expect(finding.status).toBe("warn");
    expect(finding.message).toContain("limit of 55 m");
  });

  it("falls through to the catch-all row", () => {
    const finding = evaluateRelationship(
      cableRun,
      [
        {
          productUuid: "p-cable",
          name: "Cat6A run",
          quantity: 1,
          values: { "a-grade": "cat6a", "a-link": "10g", "a-length": 80 },
        },
      ],
      context(),
    );
    expect(finding.status).toBe("pass");
  });

  it("does not apply when nothing matches a row", () => {
    const finding = evaluateRelationship(
      cableRun,
      [
        {
          productUuid: "x",
          name: "Switch",
          quantity: 1,
          values: { "a-length": 80 },
        },
      ],
      context(),
    );
    expect(finding.status).toBe("not_applicable");
  });
});

describe("Presence", () => {
  // Q27: "a camera requires a recorder" is expressed through the device_role
  // ATTRIBUTE, so it survives a category being renamed or translated.
  const needsRecorder = rule({
    uuid: "r-presence",
    name: "A camera needs a recorder",
    family: "presence",
    presence: {
      trigger: { op: "in", attr: "a-role", values: ["camera"], mode: "any" },
      requires: [
        {
          description: "Cameras need somewhere to record",
          satisfiedBy: [
            {
              type: "item_exists",
              predicate: {
                op: "in",
                attr: "a-role",
                values: ["recorder"],
                mode: "any",
              },
            },
            { type: "variable_true", variableUuid: "v-cloud" },
          ],
          perTriggerQuantity: 0,
        },
      ],
      suggestedFix: "Add an NVR, or switch on cloud recording.",
    },
  });

  it("blocks a camera with no recorder", () => {
    const finding = evaluateRelationship(
      needsRecorder,
      [switch24, camera],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.corrections[0]?.message).toContain("cloud recording");
  });

  it("passes once a recorder is in the selection", () => {
    const nvr: EngineItem = {
      productUuid: "p-nvr",
      name: "NVR",
      quantity: 1,
      values: { "a-role": ["recorder"], "a-channels": 32 },
    };
    expect(
      evaluateRelationship(needsRecorder, [camera, nvr], context()).status,
    ).toBe("pass");
  });

  // The escape hatch: the buyer said recording is in the cloud, so no on-site
  // recorder is required.
  it("accepts a project answer as an alternative", () => {
    const finding = evaluateRelationship(
      needsRecorder,
      [camera],
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
    expect(finding.status).toBe("pass");
  });

  it("does not fire when nothing triggers it", () => {
    expect(
      evaluateRelationship(needsRecorder, [switch24, patchPanel], context())
        .status,
    ).toBe("not_applicable");
  });

  // Q38(c): quantity pairing without modelling per-door grouping.
  it("pairs quantities: N doors demand N readers", () => {
    const doorRule = rule({
      uuid: "r-door",
      name: "Every door needs a reader",
      family: "presence",
      presence: {
        trigger: { op: "in", attr: "a-role", values: ["camera"], mode: "any" },
        requires: [
          {
            description: "Each camera needs its own licence",
            satisfiedBy: [
              {
                type: "item_exists",
                predicate: {
                  op: "in",
                  attr: "a-role",
                  values: ["recorder"],
                  mode: "any",
                },
              },
            ],
            perTriggerQuantity: 1,
          },
        ],
        suggestedFix: null,
      },
    });
    const oneLicence: EngineItem = {
      productUuid: "p-lic",
      name: "Licence",
      quantity: 5,
      values: { "a-role": ["recorder"] },
    };
    const finding = evaluateRelationship(
      doorRule,
      [{ ...camera, quantity: 20 }, oneLicence],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.message).toContain("need 20 in total");
    expect(finding.message).toContain("has 5");
  });
});

describe("never guessing", () => {
  // Q40, the most dangerous failure mode: a camera with a blank power draw must
  // NOT silently pass the budget check.
  const cameraFilter = {
    op: "in" as const,
    attr: "a-role",
    values: ["camera"],
    mode: "any" as const,
  };

  it("reports an unreadable item instead of skipping it silently", () => {
    const blankCamera: EngineItem = {
      productUuid: "p-blank",
      name: "Unfilled camera",
      quantity: 20,
      values: { "a-role": ["camera"] },
    };
    const finding = evaluateRelationship(
      { ...poeBudgetRule, consumerWhen: cameraFilter },
      [switch24, blankCamera],
      context(),
    );
    // The rule said consumers are cameras, and this IS a camera — so a blank
    // draw is a data gap, not a non-participant. It must never read as a pass.
    expect(finding.status).toBe("unknown");
    expect(finding.skipped).toHaveLength(1);
    expect(finding.skipped[0]?.name).toBe("Unfilled camera");
    expect(finding.message).toContain("Operating Power");
  });

  it("says so in the message when a check passed with items it could not read", () => {
    const blankCamera: EngineItem = {
      productUuid: "p-blank",
      name: "Unfilled camera",
      quantity: 1,
      values: { "a-role": ["camera"] },
    };
    const finding = evaluateRelationship(
      { ...poeBudgetRule, consumerWhen: cameraFilter },
      [switch24, { ...camera, quantity: 5 }, blankCamera],
      context(),
    );
    // 5 × 12 W fits 130 W, so the readable half passes — but the buyer must not
    // see a clean tick that quietly excluded an item.
    expect(finding.status).toBe("pass");
    expect(finding.message).toContain("could not be checked");
    expect(finding.message).toContain("Unfilled camera");
  });

  it("treats a missing value with no filter as simply not participating", () => {
    // No consumerWhen, so participation is defined by carrying the attribute.
    // The patch panel has no draw and is genuinely not part of a PoE budget.
    const finding = evaluateRelationship(
      poeBudgetRule,
      [switch24, { ...camera, quantity: 5 }, patchPanel],
      context(),
    );
    expect(finding.status).toBe("pass");
    expect(finding.skipped).toEqual([]);
  });

  it("refuses to run when the two sides' units do not convert", () => {
    const mismatched = rule({
      uuid: "r-mismatch",
      name: "Draw vs apparent power",
      family: "budget",
      consumer: { source: "spec", specUuid: "a-draw" },
      provider: {
        source: "spec",
        specUuid: "a-va",
      },
    });
    const va: AttributeMeta = {
      uuid: "a-va",
      label: "Apparent Power",
      type: "number",
      unit: "VA",
      ordered: true,
      options: [],
    };
    const finding = evaluateRelationship(
      mismatched,
      [
        {
          productUuid: "ups",
          name: "UPS",
          quantity: 1,
          values: { "a-va": 1500 },
        },
        {
          productUuid: "x",
          name: "Server",
          quantity: 1,
          values: { "a-draw": 1200 },
        },
      ],
      context({ attributes: indexAttributes([draw, va]) }),
    );
    expect(finding.status).toBe("unknown");
    expect(finding.message).toContain("apparent_power");
  });

  it("converts kW to W rather than refusing", () => {
    const kwRule = rule({
      uuid: "r-kw",
      name: "Draw vs a kW budget",
      family: "budget",
      consumer: { source: "spec", specUuid: "a-draw" },
      provider: { source: "spec", specUuid: "a-budget-kw" },
    });
    const finding = evaluateRelationship(
      kwRule,
      [
        {
          productUuid: "sw",
          name: "Big switch",
          quantity: 1,
          values: { "a-budget-kw": 1 },
        },
        { ...camera, quantity: 20 },
      ],
      context(),
    );
    // 20 × 12 W = 240 W = 0.24 kW against a 1 kW budget.
    expect(finding.status).toBe("pass");
    expect(finding.demand).toBe(0.24);
  });
});

describe("evaluateSelection", () => {
  it("puts presence findings first and splits blockers from warnings", () => {
    const presence = rule({
      uuid: "r-p",
      name: "A camera needs a recorder",
      family: "presence",
      presence: {
        trigger: { op: "in", attr: "a-role", values: ["camera"], mode: "any" },
        requires: [
          {
            description: "Cameras need somewhere to record",
            satisfiedBy: [
              {
                type: "item_exists",
                predicate: {
                  op: "in",
                  attr: "a-role",
                  values: ["recorder"],
                  mode: "any",
                },
              },
            ],
            perTriggerQuantity: 0,
          },
        ],
        suggestedFix: null,
      },
    });
    const warnOnly = {
      ...poeBudgetRule,
      uuid: "r-warn",
      gate: "warn" as const,
    };

    const report = evaluateSelection(
      [warnOnly, presence],
      [switch24, camera],
      context(),
    );
    expect(report.findings[0]?.family).toBe("presence");
    expect(report.blockers.map((f) => f.relationshipUuid)).toEqual(["r-p"]);
    expect(report.warnings.map((f) => f.relationshipUuid)).toEqual(["r-warn"]);
  });

  it("counts passes and non-applicable rules separately", () => {
    const report = evaluateSelection(
      [poeBudgetRule],
      [switch24, { ...camera, quantity: 5 }],
      context(),
    );
    expect(report.passed).toBe(1);
    expect(report.blockers).toEqual([]);
  });

  // Q28: a compliance rule scoped to one market.
  it("skips a rule outside the selection's market", () => {
    const ksaOnly = {
      ...poeBudgetRule,
      scope: { regions: ["SA"] },
    };
    const report = evaluateSelection(
      [ksaOnly],
      [switch24, camera],
      context({ region: "AE" }),
    );
    expect(report.notApplicable).toBe(1);
    expect(report.blockers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Ranges — a number answered as a span rather than a point.
//
// The whole reason a span is stored as two numbers rather than flattened to one
// is that the two ends mean different things, and the engine has to pick per
// SIDE rather than per attribute. A camera drawing 4–12 W costs 12; a switch
// budget of 120–130 W supplies 120. Every test below exists to catch the day
// somebody "simplifies" that into one number.
// ---------------------------------------------------------------------------

describe("Range values", () => {
  // A camera that draws between 4 and 12 W, on the same rule as the point-value
  // camera above. It has to cost the same as a flat 12 W one.
  const rangeCamera: EngineItem = {
    productUuid: "p-camera-range",
    name: "Varifocal dome",
    quantity: 20,
    values: {
      "a-role": ["camera"],
      "a-draw": { min: 4, max: 12 },
      "a-poe-in": "af",
    },
  };

  it("budgets a consuming range at its worst case, not its best", () => {
    const finding = evaluateRelationship(
      poeBudgetRule,
      [switch24, rangeCamera],
      context(),
    );
    // 20 × 12 = 240, exactly as if the camera were a flat 12 W part. Reading the
    // low end would give 80 W and wave a genuinely overloaded switch through.
    expect(finding.demand).toBe(240);
    expect(finding.status).toBe("block");
  });

  it("supplies from a providing range at its guaranteed end", () => {
    const rangeSwitch: EngineItem = {
      ...switch24,
      values: { ...switch24.values, "a-budget": { min: 120, max: 130 } },
    };
    const finding = evaluateRelationship(
      poeBudgetRule,
      [rangeSwitch, { ...camera, quantity: 10 }],
      context(),
    );
    // 120, never 130 — promising the top of a span is promising capacity the
    // part does not always have.
    expect(finding.capacity).toBe(120);
    expect(finding.demand).toBe(120);
    expect(finding.status).toBe("pass");
  });

  it("fails a cart that only fits at the top of the supplier's span", () => {
    const rangeSwitch: EngineItem = {
      ...switch24,
      values: { ...switch24.values, "a-budget": { min: 120, max: 130 } },
    };
    const finding = evaluateRelationship(
      poeBudgetRule,
      // 11 × 12 = 132 W: over 120, under nothing anyone promised.
      [rangeSwitch, { ...camera, quantity: 11 }],
      context(),
    );
    expect(finding.status).toBe("block");
    expect(finding.capacity).toBe(120);
  });

  it("treats a point value as the span where both ends are equal", () => {
    const flat = evaluateRelationship(
      poeBudgetRule,
      [switch24, { ...camera, quantity: 10 }],
      context(),
    );
    const spanned = evaluateRelationship(
      poeBudgetRule,
      [
        switch24,
        {
          ...camera,
          quantity: 10,
          values: { ...camera.values, "a-draw": { min: 12, max: 12 } },
        },
      ],
      context(),
    );
    expect(spanned.demand).toBe(flat.demand);
    expect(spanned.status).toBe(flat.status);
  });

  it("reports a malformed span as unreadable rather than counting it", () => {
    const halfFilled: EngineItem = {
      productUuid: "p-camera-broken",
      name: "Half-filled camera",
      quantity: 5,
      // Only one end — exactly what a form would produce mid-typing. It must
      // not read as 0 W, and it must not read as absent either.
      values: {
        "a-role": ["camera"],
        "a-draw": { min: 4 } as unknown as number,
        "a-poe-in": "af",
      },
    };
    const finding = evaluateRelationship(
      {
        ...poeBudgetRule,
        consumerWhen: {
          op: "in",
          attr: "a-role",
          values: ["camera"],
          mode: "any",
        },
      },
      [switch24, halfFilled],
      context(),
    );
    expect(finding.status).toBe("unknown");
    expect(finding.skipped.map((entry) => entry.name)).toContain(
      "Half-filled camera",
    );
  });

  it("names both ends when it explains the value", () => {
    const finding = evaluateRelationship(
      rule({
        uuid: "r-match-range",
        name: "Draw within the port maximum",
        family: "budget",
        perItem: true,
        consumer: { source: "spec", specUuid: "a-draw" },
        provider: { source: "spec", specUuid: "a-budget" },
      }),
      [
        { ...switch24, values: { ...switch24.values, "a-budget": 5 } },
        rangeCamera,
      ],
      context(),
    );
    expect(finding.status).toBe("block");
    // The buyer is shown the number that failed, which for a consumer is the
    // top of the span.
    expect(finding.failingItems[0]?.unitValue).toBe(12);
  });
});
