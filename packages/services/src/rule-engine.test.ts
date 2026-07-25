import { describe, expect, it } from "vitest";
import { evaluateRule, evaluateRules } from "./rule-engine";
import type {
  EngineCatalogProduct,
  EngineItem,
  EngineRule,
} from "./rule-engine";

// The canonical worked example: cameras drawing PoE power from a switch with
// a finite budget. The engine knows none of this — it only sees spec keys.

const poeBudgetRule: EngineRule = {
  uuid: "rule-1",
  name: "PoE power budget",
  description: null,
  kind: "sum_budget",
  comparator: "lte",
  headroomPercent: 90,
  condition: { specKey: "poe", values: ["Yes"] },
  allocation: "pooled",
  severity: "block",
  consumerSpec: { key: "power-consumption", label: "Power Consumption", unit: "W" },
  providerSpec: { key: "poe-budget", label: "PoE Budget", unit: "W" },
};

const portCountRule: EngineRule = {
  uuid: "rule-2",
  name: "Switch port capacity",
  description: null,
  kind: "count_limit",
  comparator: "lte",
  headroomPercent: 100,
  condition: null,
  allocation: "pooled",
  severity: "block",
  consumerSpec: { key: "power-consumption", label: "Power Consumption", unit: "W" },
  providerSpec: { key: "port-count", label: "Port Count", unit: "ports" },
};

const perPortRule: EngineRule = {
  uuid: "rule-3",
  name: "Per-port PoE limit",
  description: null,
  kind: "per_item_threshold",
  comparator: "lte",
  headroomPercent: 100,
  condition: null,
  allocation: "pooled",
  severity: "block",
  consumerSpec: { key: "power-consumption", label: "Power Consumption", unit: "W" },
  providerSpec: { key: "poe-per-port-max", label: "PoE Per-Port Max", unit: "W" },
};

const smallSwitch: EngineItem = {
  productUuid: "switch-8p",
  name: "8-Port PoE Switch",
  quantity: 1,
  attributes: { "poe-budget": "130", "port-count": "8", "poe-per-port-max": "30" },
};

const bigSwitch: EngineCatalogProduct = {
  productUuid: "switch-24p",
  name: "24-Port PoE Switch",
  attributes: { "poe-budget": "370", "port-count": "24", "poe-per-port-max": "30" },
};

const camera = (uuid: string, watts: string, quantity: number): EngineItem => ({
  productUuid: uuid,
  name: `Camera ${uuid}`,
  quantity,
  attributes: { "power-consumption": watts, poe: "Yes" },
});

const catalog: EngineCatalogProduct[] = [
  { productUuid: smallSwitch.productUuid, name: smallSwitch.name, attributes: smallSwitch.attributes },
  bigSwitch,
];

describe("evaluateRule — sum_budget", () => {
  it("passes when total draw fits the usable budget", () => {
    const result = evaluateRule(
      poeBudgetRule,
      [smallSwitch, camera("d340", "6.5", 8)],
      catalog,
    );
    // 8 x 6.5 = 52 <= 130 x 90% = 117
    expect(result.status).toBe("pass");
    expect(result.demand).toBe(52);
    expect(result.effectiveCapacity).toBe(117);
  });

  it("fails when total draw exceeds the usable budget and suggests a bigger provider", () => {
    const result = evaluateRule(
      poeBudgetRule,
      [smallSwitch, camera("b850", "12", 20)],
      catalog,
    );
    // 20 x 12 = 240 > 117
    expect(result.status).toBe("fail");
    expect(result.demand).toBe(240);
    expect(result.suggestions.map((s) => s.productUuid)).toEqual(["switch-24p"]);
  });

  it("only counts consumers matching the condition", () => {
    const nonPoeDevice: EngineItem = {
      productUuid: "nvr",
      name: "NVR",
      quantity: 1,
      attributes: { "power-consumption": "40", poe: "No" },
    };
    const result = evaluateRule(
      poeBudgetRule,
      [smallSwitch, camera("d340", "6.5", 4), nonPoeDevice],
      catalog,
    );
    expect(result.demand).toBe(26); // the 40 W NVR is filtered out
    expect(result.consumers).toHaveLength(1);
  });

  it("fails with a missing-provider message when nothing supplies capacity", () => {
    const result = evaluateRule(poeBudgetRule, [camera("d340", "6.5", 4)], catalog);
    expect(result.status).toBe("fail");
    expect(result.capacity).toBe(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("is not applicable when no consumer carries the spec", () => {
    const result = evaluateRule(poeBudgetRule, [smallSwitch], catalog);
    expect(result.status).toBe("not_applicable");
  });

  it("pools capacity across multiple provider units", () => {
    const twoSwitches = { ...smallSwitch, quantity: 2 };
    const result = evaluateRule(
      poeBudgetRule,
      [twoSwitches, camera("b850", "12", 18)],
      catalog,
    );
    // 216 <= (2 x 130) x 90% = 234
    expect(result.status).toBe("pass");
    expect(result.effectiveCapacity).toBe(234);
  });
});

describe("evaluateRule — range & multi-select specs", () => {
  it("budgets a range consumer at its max (worst case)", () => {
    const rangeCamera: EngineItem = {
      productUuid: "rng-cam",
      name: "Range Camera",
      quantity: 8,
      attributes: { "power-consumption": "6.5 - 9", poe: "Yes" },
    };
    const result = evaluateRule(
      poeBudgetRule,
      [smallSwitch, rangeCamera],
      catalog,
    );
    // reads the max (9): 8 x 9 = 72 <= 130 x 90% = 117
    expect(result.demand).toBe(72);
    expect(result.status).toBe("pass");
  });

  it("counts a range provider at its min (guaranteed capacity)", () => {
    const rangeSwitch: EngineItem = {
      productUuid: "rng-switch",
      name: "Range Switch",
      quantity: 1,
      attributes: {
        "poe-budget": "100 - 130",
        "port-count": "8",
        "poe-per-port-max": "30",
      },
    };
    const result = evaluateRule(
      poeBudgetRule,
      [rangeSwitch, camera("b850", "12", 10)],
      catalog,
    );
    // reads the min (100): usable 100 x 90% = 90; demand 10 x 12 = 120 > 90
    expect(result.capacity).toBe(100);
    expect(result.effectiveCapacity).toBe(90);
    expect(result.status).toBe("fail");
  });

  it("matches a multi-select condition on any ticked value", () => {
    const multiCamera: EngineItem = {
      productUuid: "multi-cam",
      name: "Multi Camera",
      quantity: 4,
      attributes: { "power-consumption": "6.5", poe: "Yes, PoE+" },
    };
    const result = evaluateRule(
      poeBudgetRule,
      [smallSwitch, multiCamera],
      catalog,
    );
    // the condition asks for "Yes"; the device ticked "Yes, PoE+" — it counts
    expect(result.consumers).toHaveLength(1);
    expect(result.demand).toBe(26); // 4 x 6.5
  });
});

describe("evaluateRule — count_limit", () => {
  it("fails when there are more devices than ports", () => {
    const result = evaluateRule(
      portCountRule,
      [smallSwitch, camera("d340", "6.5", 10)],
      catalog,
    );
    expect(result.status).toBe("fail");
    expect(result.demand).toBe(10);
    expect(result.effectiveCapacity).toBe(8);
    expect(result.suggestions.map((s) => s.productUuid)).toEqual(["switch-24p"]);
  });
});

describe("evaluateRule — per_provider allocation", () => {
  const perDeviceBudget: EngineRule = {
    ...poeBudgetRule,
    uuid: "rule-dist",
    name: "Per-switch power budget",
    headroomPercent: 100,
    condition: null,
    allocation: "per_provider",
  };

  const switch300 = (quantity: number): EngineItem => ({
    productUuid: "switch-300",
    name: "300 W Switch",
    quantity,
    attributes: { "poe-budget": "300" },
  });

  it("distributes items across provider units and reports per-unit bins", () => {
    const result = evaluateRule(
      perDeviceBudget,
      [switch300(2), camera("cam", "100", 5)],
      [],
    );
    // 5 x 100 W over two separate 300 W bins -> 3 + 2, both fit.
    expect(result.status).toBe("pass");
    expect(result.bins).toHaveLength(2);
    expect(result.bins.map((bin) => bin.used).sort()).toEqual([200, 300]);
  });

  it("fails when no single unit can host the remainder, even if the pool could", () => {
    const result = evaluateRule(
      perDeviceBudget,
      [switch300(2), camera("cam", "200", 3)],
      [],
    );
    // Pooled: 600 <= 600 would pass. Per device: 200 + 200 + 200 cannot be
    // split over two 300 W bins (one item each, third fits nowhere).
    expect(result.status).toBe("fail");
    expect(result.failingItems).toHaveLength(1);
    expect(result.failingItems[0].quantity).toBe(1);
  });
});

describe("evaluateRule — eq comparator", () => {
  const voltageRule: EngineRule = {
    ...poeBudgetRule,
    uuid: "rule-eq",
    name: "Exact voltage match",
    kind: "per_item_threshold",
    comparator: "eq",
    headroomPercent: 100,
    condition: null,
    consumerSpec: { key: "input-voltage", label: "Input Voltage", unit: "V" },
    providerSpec: { key: "output-voltage", label: "Output Voltage", unit: "V" },
  };

  const psu: EngineItem = {
    productUuid: "psu-12",
    name: "12 V PSU",
    quantity: 1,
    attributes: { "output-voltage": "12" },
  };

  it("passes only on an exact match", () => {
    const device = (volts: string): EngineItem => ({
      productUuid: `dev-${volts}`,
      name: `Device ${volts} V`,
      quantity: 1,
      attributes: { "input-voltage": volts },
    });
    expect(evaluateRule(voltageRule, [psu, device("12")], []).status).toBe(
      "pass",
    );
    expect(evaluateRule(voltageRule, [psu, device("24")], []).status).toBe(
      "fail",
    );
    expect(evaluateRule(voltageRule, [psu, device("5")], []).status).toBe(
      "fail",
    );
  });
});

describe("evaluateRule — per_item_threshold", () => {
  it("flags only the items above the per-item limit", () => {
    const heavyPtz = camera("ptz", "45", 1); // above the 30 W per-port max
    const result = evaluateRule(
      perPortRule,
      [smallSwitch, camera("d340", "6.5", 5), heavyPtz],
      catalog,
    );
    expect(result.status).toBe("fail");
    expect(result.failingItems.map((item) => item.productUuid)).toEqual(["ptz"]);
  });
});

describe("evaluateRules — the user's 20-camera example", () => {
  it("reports all three rules over one selection", () => {
    const selection = [smallSwitch, camera("b850", "12", 20)];
    const report = evaluateRules(
      [poeBudgetRule, portCountRule, perPortRule],
      selection,
      catalog,
    );
    // 240 W > 117 W usable and 20 devices > 8 ports; each 12 W item fits 30 W.
    expect(report.failures).toBe(2);
    expect(report.passed).toBe(1);
  });
});

describe("evaluateRule — ratio (oversubscription)", () => {
  const uplinkRatioRule: EngineRule = {
    uuid: "ratio-1",
    name: "Uplink oversubscription",
    description: null,
    kind: "ratio",
    comparator: "lte",
    headroomPercent: 100,
    ratioLimit: "20",
    condition: null,
    allocation: "pooled",
    severity: "warn",
    consumerSpec: { key: "access-gbps", label: "Access demand", unit: "Gbps" },
    providerSpec: { key: "uplink-gbps", label: "Uplink", unit: "Gbps" },
  };

  const accessDemand = (gbps: string, quantity: number): EngineItem => ({
    productUuid: `access-${gbps}-${quantity}`,
    name: "Access load",
    quantity,
    attributes: { "access-gbps": gbps },
  });
  const uplink = (gbps: string): EngineItem => ({
    productUuid: "uplink",
    name: "Uplink",
    quantity: 1,
    attributes: { "uplink-gbps": gbps },
  });

  it("passes when demand ÷ supply is within the target ratio", () => {
    // 40 Gbps demand ÷ 10 Gbps uplink = 4:1, within 20:1.
    const result = evaluateRule(
      uplinkRatioRule,
      [accessDemand("40", 1), uplink("10")],
      [],
    );
    expect(result.status).toBe("pass");
  });

  it("warns when the ratio exceeds the target", () => {
    // 480 Gbps demand ÷ 10 Gbps uplink = 48:1, over 20:1.
    const result = evaluateRule(
      uplinkRatioRule,
      [accessDemand("48", 10), uplink("10")],
      [],
    );
    expect(result.status).toBe("warn");
    expect(result.demand).toBe(480);
    expect(result.capacity).toBe(10);
  });
});

describe("evaluateRule — spec_match (Match on select specs)", () => {
  const impedanceRule: EngineRule = {
    uuid: "match-1",
    name: "Speaker impedance ∈ amp support",
    description: null,
    kind: "spec_match",
    comparator: "in",
    headroomPercent: 100,
    condition: null,
    allocation: "pooled",
    severity: "block",
    consumerSpec: { key: "impedance", label: "Impedance", unit: null },
    providerSpec: {
      key: "impedance-support",
      label: "Supported impedance",
      unit: null,
    },
  };

  const speaker = (uuid: string, ohms: string): EngineItem => ({
    productUuid: uuid,
    name: `Speaker ${ohms}`,
    quantity: 1,
    attributes: { impedance: ohms },
  });
  const amp = (support: string): EngineItem => ({
    productUuid: "amp",
    name: "Amplifier",
    quantity: 1,
    attributes: { "impedance-support": support },
  });

  it("passes when every speaker's impedance is supported", () => {
    const result = evaluateRule(
      impedanceRule,
      [speaker("s1", "8Ω"), amp("4Ω,6Ω,8Ω")],
      [],
    );
    expect(result.status).toBe("pass");
  });

  it("fails the speaker whose impedance the amp doesn't support", () => {
    const result = evaluateRule(
      impedanceRule,
      [speaker("s1", "8Ω"), speaker("s2", "2Ω"), amp("4Ω,6Ω,8Ω")],
      [],
    );
    expect(result.status).toBe("fail");
    expect(result.failingItems.map((item) => item.productUuid)).toEqual(["s2"]);
  });

  it("is not applicable when no provider is present (Presence handles that)", () => {
    const result = evaluateRule(impedanceRule, [speaker("s1", "8Ω")], []);
    expect(result.status).toBe("not_applicable");
  });

  it("intersects: passes when codec sets overlap", () => {
    const codecRule: EngineRule = {
      ...impedanceRule,
      uuid: "match-2",
      comparator: "intersects",
      severity: "warn",
      consumerSpec: { key: "codecs", label: "Phone codecs", unit: null },
      providerSpec: { key: "pbx-codecs", label: "PBX codecs", unit: null },
    };
    const phone: EngineItem = {
      productUuid: "phone",
      name: "Phone",
      quantity: 1,
      attributes: { codecs: "G.711,Opus" },
    };
    const pbx: EngineItem = {
      productUuid: "pbx",
      name: "PBX",
      quantity: 1,
      attributes: { "pbx-codecs": "G.729,Opus" },
    };
    expect(evaluateRule(codecRule, [phone, pbx], []).status).toBe("pass");
  });

  describe("ordered scales", () => {
    // PoE grades are a scale, so "at most what the switch supplies" is a
    // position comparison, not set membership: an af device fits an at switch.
    const POE_SCALE = ["802.3af", "802.3at", "802.3bt"];

    const poeRule: EngineRule = {
      ...impedanceRule,
      uuid: "match-ordered",
      comparator: "lte",
      consumerSpec: {
        key: "poe-required",
        label: "PoE required",
        unit: null,
        ordered: true,
        scale: POE_SCALE,
      },
      providerSpec: {
        key: "poe-supplied",
        label: "PoE supplied",
        unit: null,
        ordered: true,
        scale: POE_SCALE,
      },
    };

    const device = (uuid: string, grade: string): EngineItem => ({
      productUuid: uuid,
      name: `Device ${grade}`,
      quantity: 1,
      attributes: { "poe-required": grade },
    });
    const injector = (grade: string): EngineItem => ({
      productUuid: "switch",
      name: "Switch",
      quantity: 1,
      attributes: { "poe-supplied": grade },
    });

    it("passes a lower grade against a higher one", () => {
      const result = evaluateRule(
        poeRule,
        [device("d1", "802.3af"), injector("802.3at")],
        [],
      );
      expect(result.status).toBe("pass");
    });

    it("fails a higher grade against a lower one", () => {
      const result = evaluateRule(
        poeRule,
        [device("d1", "802.3bt"), injector("802.3at")],
        [],
      );
      expect(result.status).toBe("fail");
      expect(result.failingItems.map((item) => item.productUuid)).toEqual([
        "d1",
      ]);
    });

    it("passes an equal grade", () => {
      expect(
        evaluateRule(poeRule, [device("d1", "802.3at"), injector("802.3at")], [])
          .status,
      ).toBe("pass");
    });

    it("degrades to membership when neither spec is an ordered scale", () => {
      // Without a scale there is no "at most", so comparing alphabetically
      // would be nonsense — fall back to consumer ⊆ provider.
      const unordered: EngineRule = {
        ...poeRule,
        consumerSpec: { key: "poe-required", label: "PoE required", unit: null },
        providerSpec: { key: "poe-supplied", label: "PoE supplied", unit: null },
      };
      expect(
        evaluateRule(
          unordered,
          [device("d1", "802.3af"), injector("802.3at")],
          [],
        ).status,
      ).toBe("fail");
      expect(
        evaluateRule(
          unordered,
          [device("d1", "802.3at"), injector("802.3at")],
          [],
        ).status,
      ).toBe("pass");
    });
  });
});
