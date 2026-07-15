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
