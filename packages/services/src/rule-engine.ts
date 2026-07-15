import type { SelectCompatibilityRules } from "../../../db/schema/compatibility-rules";
import type { SelectProducts } from "../../../db/schema/products";
import type { SelectSpecifications } from "../../../db/schema/specifications";

// ---------------------------------------------------------------------------
// The generic compatibility evaluator. It knows nothing about PoE, cameras,
// or switches — only how to take a rule row, resolve its participants by
// spec key, aggregate, compare, and report. All meaning lives in the data.
//
// Semantics per rule kind (comparator "lte" shown; "gte" flips it):
// - sum_budget:          SUM(consumer value x qty)  <=  pooled capacity x headroom
// - count_limit:         SUM(qty of consumer items) <=  pooled capacity x headroom
// - per_item_threshold:  each item's own value      <=  best provider value x headroom
//
// Pooled capacity = SUM(provider value x qty) across every selected product
// that carries the provider spec. Consumers are every selected product that
// carries the consumer spec (optionally filtered by the rule's condition).
// ---------------------------------------------------------------------------

export type SelectionInput = {
  productUuid: string;
  quantity: number;
};

// A resolved spec as the engine needs it — key to read values by, label/unit
// to speak with.
export type EngineSpec = {
  key: SelectSpecifications["key"];
  label: SelectSpecifications["label"];
  unit: SelectSpecifications["unit"];
};

// A rule with both specs resolved — the pure evaluator's input shape.
export type EngineRule = {
  uuid: SelectCompatibilityRules["uuid"];
  name: SelectCompatibilityRules["name"];
  description: SelectCompatibilityRules["description"];
  kind: SelectCompatibilityRules["kind"];
  comparator: SelectCompatibilityRules["comparator"];
  headroomPercent: SelectCompatibilityRules["headroomPercent"];
  condition: SelectCompatibilityRules["condition"];
  severity: SelectCompatibilityRules["severity"];
  consumerSpec: EngineSpec;
  providerSpec: EngineSpec;
};

export type EngineItem = {
  productUuid: SelectProducts["uuid"];
  name: SelectProducts["name"];
  quantity: number;
  attributes: NonNullable<SelectProducts["technicalAttributes"]>;
};

export type EngineCatalogProduct = Omit<EngineItem, "quantity">;

export type RuleParticipant = {
  productUuid: SelectProducts["uuid"];
  name: SelectProducts["name"];
  quantity: number;
  unitValue: number; // spec value per unit
  totalValue: number; // unitValue x quantity
};

export type RuleSuggestion = {
  productUuid: SelectProducts["uuid"];
  name: SelectProducts["name"];
  capacity: number;
};

export type RuleStatus = "pass" | "warn" | "fail" | "not_applicable";

export type RuleEvaluation = {
  ruleUuid: EngineRule["uuid"];
  name: EngineRule["name"];
  description: EngineRule["description"];
  kind: EngineRule["kind"];
  severity: EngineRule["severity"];
  comparator: EngineRule["comparator"];
  headroomPercent: EngineRule["headroomPercent"];
  consumerLabel: EngineSpec["label"];
  providerLabel: EngineSpec["label"];
  unit: EngineSpec["unit"];
  status: RuleStatus;
  demand: number;
  capacity: number;
  effectiveCapacity: number;
  message: string;
  consumers: RuleParticipant[];
  providers: RuleParticipant[];
  failingItems: RuleParticipant[];
  suggestions: RuleSuggestion[];
};

export type CompatibilityReport = {
  results: RuleEvaluation[];
  passed: number;
  warnings: number;
  failures: number;
  notApplicable: number;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

// Read a numeric spec value off a product's attribute map. Values are stored
// as strings (the map is shared with dropdown specs) — non-numeric or absent
// means the product doesn't carry this spec.
const numericValue = (
  attributes: Record<string, string>,
  key: string,
): number | null => {
  const raw = attributes[key];
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const matchesCondition = (
  item: EngineItem,
  condition: EngineRule["condition"],
): boolean => {
  if (!condition || condition.values.length === 0) {
    return true;
  }
  return condition.values.includes(item.attributes[condition.specKey] ?? "");
};

const compare = (
  demand: number,
  limit: number,
  comparator: EngineRule["comparator"],
): boolean => (comparator === "lte" ? demand <= limit : demand >= limit);

const formatValue = (value: number, unit: EngineSpec["unit"]): string =>
  unit ? `${round2(value)} ${unit}` : `${round2(value)}`;

// Catalog products that could satisfy the failed demand on their own,
// smallest sufficient capacity first — the "recommend direction" of the
// same rule: instead of judging a chosen provider, search for a valid one.
const findSuggestions = (
  rule: EngineRule,
  demand: number,
  catalog: EngineCatalogProduct[],
): RuleSuggestion[] => {
  if (rule.comparator !== "lte") {
    return [];
  }
  return catalog
    .flatMap((product) => {
      const capacity = numericValue(product.attributes, rule.providerSpec.key);
      if (capacity === null) {
        return [];
      }
      const usable = (capacity * rule.headroomPercent) / 100;
      return usable >= demand
        ? [{ productUuid: product.productUuid, name: product.name, capacity }]
        : [];
    })
    .sort((a, b) => a.capacity - b.capacity)
    .slice(0, 3);
};

/** Evaluate one rule against a selection — pure, no I/O. */
export const evaluateRule = (
  rule: EngineRule,
  selection: EngineItem[],
  catalog: EngineCatalogProduct[],
): RuleEvaluation => {
  const consumers: RuleParticipant[] = selection.flatMap((item) => {
    const unitValue = numericValue(item.attributes, rule.consumerSpec.key);
    if (unitValue === null || !matchesCondition(item, rule.condition)) {
      return [];
    }
    return [
      {
        productUuid: item.productUuid,
        name: item.name,
        quantity: item.quantity,
        unitValue,
        totalValue: round2(unitValue * item.quantity),
      },
    ];
  });

  const providers: RuleParticipant[] = selection.flatMap((item) => {
    const unitValue = numericValue(item.attributes, rule.providerSpec.key);
    if (unitValue === null) {
      return [];
    }
    return [
      {
        productUuid: item.productUuid,
        name: item.name,
        quantity: item.quantity,
        unitValue,
        totalValue: round2(unitValue * item.quantity),
      },
    ];
  });

  const base = {
    ruleUuid: rule.uuid,
    name: rule.name,
    description: rule.description,
    kind: rule.kind,
    severity: rule.severity,
    comparator: rule.comparator,
    headroomPercent: rule.headroomPercent,
    consumerLabel: rule.consumerSpec.label,
    providerLabel: rule.providerSpec.label,
    unit: rule.providerSpec.unit,
    consumers,
    providers,
    failingItems: [] as RuleParticipant[],
    suggestions: [] as RuleSuggestion[],
  };

  if (consumers.length === 0) {
    return {
      ...base,
      status: "not_applicable",
      demand: 0,
      capacity: 0,
      effectiveCapacity: 0,
      message: `Nothing in the selection carries "${rule.consumerSpec.label}" — rule does not apply.`,
    };
  }

  const violationStatus: RuleStatus = rule.severity === "warn" ? "warn" : "fail";

  // Demand per kind: what the consumers collectively (or individually) ask of
  // the provider capacity.
  const demand =
    rule.kind === "count_limit"
      ? consumers.reduce((sum, consumer) => sum + consumer.quantity, 0)
      : round2(
          consumers.reduce((sum, consumer) => sum + consumer.totalValue, 0),
        );

  if (providers.length === 0) {
    return {
      ...base,
      status: violationStatus,
      demand,
      capacity: 0,
      effectiveCapacity: 0,
      message: `The selection needs ${rule.kind === "count_limit" ? `${demand}` : formatValue(demand, rule.providerSpec.unit)} of "${rule.providerSpec.label}", but nothing in it provides that capacity.`,
      suggestions: findSuggestions(rule, demand, catalog),
    };
  }

  if (rule.kind === "per_item_threshold") {
    // Each consumer unit must fit the best single provider value (e.g. one
    // camera's draw vs the per-port maximum) — never an aggregate.
    const limit = Math.max(...providers.map((provider) => provider.unitValue));
    const effective = round2((limit * rule.headroomPercent) / 100);
    const failing = consumers.filter(
      (consumer) => !compare(consumer.unitValue, effective, rule.comparator),
    );
    const worst = Math.max(...consumers.map((c) => c.unitValue));

    if (failing.length === 0) {
      return {
        ...base,
        status: "pass",
        demand: worst,
        capacity: limit,
        effectiveCapacity: effective,
        message: `Every item's "${rule.consumerSpec.label}" (highest: ${formatValue(worst, rule.consumerSpec.unit)}) fits the per-item limit of ${formatValue(effective, rule.providerSpec.unit)}.`,
      };
    }
    return {
      ...base,
      status: violationStatus,
      demand: worst,
      capacity: limit,
      effectiveCapacity: effective,
      failingItems: failing,
      message: `${failing.length} item(s) exceed the per-item limit of ${formatValue(effective, rule.providerSpec.unit)}: ${failing
        .map((f) => `${f.name} (${formatValue(f.unitValue, rule.consumerSpec.unit)})`)
        .join(", ")}.`,
      suggestions: findSuggestions(rule, worst, catalog),
    };
  }

  // Pooled capacity across every provider in the selection.
  const capacity = round2(
    providers.reduce((sum, provider) => sum + provider.totalValue, 0),
  );
  const effective = round2((capacity * rule.headroomPercent) / 100);
  const headroomNote =
    rule.headroomPercent === 100
      ? ""
      : ` (${formatValue(capacity, rule.providerSpec.unit)} × ${rule.headroomPercent}%)`;
  const demandLabel =
    rule.kind === "count_limit"
      ? `${demand} unit(s)`
      : formatValue(demand, rule.providerSpec.unit);

  if (compare(demand, effective, rule.comparator)) {
    return {
      ...base,
      status: "pass",
      demand,
      capacity,
      effectiveCapacity: effective,
      message: `Total "${rule.consumerSpec.label}" of ${demandLabel} fits the usable "${rule.providerSpec.label}" of ${formatValue(effective, rule.providerSpec.unit)}${headroomNote}.`,
    };
  }

  const gap = round2(Math.abs(demand - effective));
  return {
    ...base,
    status: violationStatus,
    demand,
    capacity,
    effectiveCapacity: effective,
    message: `Total "${rule.consumerSpec.label}" of ${demandLabel} ${rule.comparator === "lte" ? "exceeds" : "falls below"} the usable "${rule.providerSpec.label}" of ${formatValue(effective, rule.providerSpec.unit)}${headroomNote} — ${rule.comparator === "lte" ? "over" : "short"} by ${formatValue(gap, rule.providerSpec.unit)}.`,
    suggestions: findSuggestions(rule, demand, catalog),
  };
};

/** Evaluate every rule against a selection — pure, no I/O. */
export const evaluateRules = (
  rules: EngineRule[],
  selection: EngineItem[],
  catalog: EngineCatalogProduct[],
): CompatibilityReport => {
  const results = rules.map((rule) => evaluateRule(rule, selection, catalog));
  return {
    results,
    passed: results.filter((result) => result.status === "pass").length,
    warnings: results.filter((result) => result.status === "warn").length,
    failures: results.filter((result) => result.status === "fail").length,
    notApplicable: results.filter(
      (result) => result.status === "not_applicable",
    ).length,
  };
};

