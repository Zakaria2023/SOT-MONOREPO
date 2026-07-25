import { parseSpecRange, parseSpecValues } from "utils";
import type { SelectCompatibilityRules } from "../../../db/schema/compatibility-rules";
import type { SelectProducts } from "../../../db/schema/products";
import type { SelectSpecifications } from "../../../db/schema/specifications";
import type { LookupTable } from "../../../db/types";

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
  // Whether this spec's option list is an ordered scale (802.3af < at < bt).
  // The lte/gte comparators only mean something on a scale, so they compare a
  // value's position in `scale` when this is on. Optional — a spec with no
  // scale (every numeric spec, and any unordered select) is simply not ordered.
  ordered?: SelectSpecifications["ordered"];
  // The master option values in scale order. Empty/absent for a numeric spec.
  scale?: string[];
  // True when this side of the rule is a PROJECT VARIABLE rather than a
  // product spec — a number the design answers (expected concurrent calls)
  // instead of one a product carries. It resolves from the variables context
  // rather than from any item's attributes, and contributes once, not per
  // item, because a project answers the question once.
  isVariable?: boolean;
};

// The design's answers to the project variables, keyed by variable key. Rules
// with a variable operand read their number from here.
export type VariableContext = Record<string, number>;

// A rule with both specs resolved — the pure evaluator's input shape.
export type EngineRule = {
  uuid: SelectCompatibilityRules["uuid"];
  name: SelectCompatibilityRules["name"];
  description: SelectCompatibilityRules["description"];
  kind: SelectCompatibilityRules["kind"];
  comparator: SelectCompatibilityRules["comparator"];
  headroomPercent: SelectCompatibilityRules["headroomPercent"];
  // Only the "ratio" kind uses this; optional so other rules omit it.
  ratioLimit?: SelectCompatibilityRules["ratioLimit"];
  allocation: SelectCompatibilityRules["allocation"];
  condition: SelectCompatibilityRules["condition"];
  severity: SelectCompatibilityRules["severity"];
  consumerSpec: EngineSpec;
  providerSpec: EngineSpec;
  // "conditional" only: the table the limit is read from. The capacity side of
  // a conditional rule is this table, not a provider product, so providerSpec
  // carries only a label/unit for reporting.
  lookup?: LookupTable | null;
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

// One physical provider unit (e.g. one of the two switches) in a
// per-provider distribution, with what was placed into it.
export type ProviderBin = {
  productUuid: SelectProducts["uuid"];
  name: SelectProducts["name"];
  // 1-based unit number among that product's quantity (Switch #1, #2, ...).
  unitIndex: number;
  capacity: number; // effective (after headroom)
  used: number;
  items: {
    productUuid: SelectProducts["uuid"];
    name: SelectProducts["name"];
    count: number;
    unitValue: number;
  }[];
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
  // Filled only for per_provider allocation: how consumers were distributed
  // across the individual provider units.
  bins: ProviderBin[];
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
// means the product doesn't carry this spec. A range spec ("from - to") is
// reduced to a single bound: a consumer reads its max (worst-case demand), a
// provider reads its min (guaranteed capacity).
const numericValue = (
  attributes: Record<string, string>,
  key: string,
  bound: "min" | "max" = "max",
): number | null => {
  const raw = attributes[key];
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  const range = parseSpecRange(raw);
  if (range) {
    return bound === "min" ? range.min : range.max;
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
  // The condition spec may be multi-select (comma-joined) — it matches when any
  // ticked value is one the condition asks for.
  const selected = parseSpecValues(item.attributes[condition.specKey]);
  return selected.some((value) => condition.values.includes(value));
};

const compare = (
  demand: number,
  limit: number,
  comparator: EngineRule["comparator"],
): boolean => {
  if (comparator === "lte") {
    return demand <= limit;
  }
  if (comparator === "gte") {
    return demand >= limit;
  }
  return demand === limit;
};

// How a violated comparison reads in a message: over the limit, under it, or
// simply not the exact required value.
const violationWord = (comparator: EngineRule["comparator"]): string => {
  if (comparator === "lte") {
    return "exceeds";
  }
  if (comparator === "gte") {
    return "falls below";
  }
  return "does not match";
};

const gapWord = (comparator: EngineRule["comparator"]): string => {
  if (comparator === "lte") {
    return "over";
  }
  if (comparator === "gte") {
    return "short";
  }
  return "off";
};

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
  // "At least" rules have no meaningful single-product fix to suggest.
  if (rule.comparator === "gte") {
    return [];
  }
  return catalog
    .flatMap((product) => {
      const capacity = numericValue(
        product.attributes,
        rule.providerSpec.key,
        "min",
      );
      if (capacity === null) {
        return [];
      }
      const usable = (capacity * rule.headroomPercent) / 100;
      const satisfies =
        rule.comparator === "eq" ? usable === demand : usable >= demand;
      return satisfies
        ? [{ productUuid: product.productUuid, name: product.name, capacity }]
        : [];
    })
    .sort((a, b) => a.capacity - b.capacity)
    .slice(0, 3);
};

// Position of a value on an ordered scale, searching the provider's option
// list first then the consumer's — the two specs normally share a list, but a
// value only present on one side still ranks. -1 when it's on neither.
const rankOnScale = (value: string, scales: string[][]): number => {
  for (const scale of scales) {
    const index = scale.indexOf(value);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
};

// spec_match: does a consumer's chosen SELECT value(s) fit a provider's?
//   in         → consumer values ⊆ provider set (impedance ∈ supported)
//   intersects → the two sets overlap (codec intersection ≠ ∅)
//   lte / gte  → position on the ordered scale (a PoE af device fits an at
//                switch, but not the reverse; Cat6 fits a Cat6a run)
//   eq / other → the two sets are equal (intercom system type match)
const specMatchSatisfied = (
  consumerValues: string[],
  providerValues: string[],
  rule: EngineRule,
): boolean => {
  const comparator = rule.comparator;
  const provider = new Set(providerValues);

  if (comparator === "intersects") {
    return consumerValues.some((value) => provider.has(value));
  }
  if (comparator === "in") {
    return (
      consumerValues.length > 0 &&
      consumerValues.every((value) => provider.has(value))
    );
  }

  if (comparator === "lte" || comparator === "gte") {
    // A ceiling comparison is only meaningful on a scale. An unordered
    // attribute has no "at most", so it degrades to plain membership rather
    // than silently comparing alphabetical positions.
    if (!rule.providerSpec.ordered && !rule.consumerSpec.ordered) {
      return (
        consumerValues.length > 0 &&
        consumerValues.every((value) => provider.has(value))
      );
    }
    const scales = [
      rule.providerSpec.scale ?? [],
      rule.consumerSpec.scale ?? [],
    ];
    const providerRanks = providerValues
      .map((value) => rankOnScale(value, scales))
      .filter((rank) => rank >= 0);
    const consumerRanks = consumerValues
      .map((value) => rankOnScale(value, scales))
      .filter((rank) => rank >= 0);
    if (providerRanks.length === 0 || consumerRanks.length === 0) {
      return false;
    }
    // The provider offers its best rung: the highest it supports for "at
    // most", the lowest it requires for "at least".
    const best =
      comparator === "lte"
        ? Math.max(...providerRanks)
        : Math.min(...providerRanks);
    return consumerRanks.every((rank) =>
      comparator === "lte" ? rank <= best : rank >= best,
    );
  }

  const consumer = new Set(consumerValues);
  return (
    consumer.size === provider.size &&
    [...consumer].every((value) => provider.has(value))
  );
};

// The Match family over SELECT specs. Per-item: each consumer must find some
// provider it's compatible with. Absence of a provider is a Presence concern,
// so it reports not_applicable rather than failing here.
const evaluateSpecMatch = (
  rule: EngineRule,
  selection: EngineItem[],
): RuleEvaluation => {
  const participant = (item: EngineItem): RuleParticipant => ({
    productUuid: item.productUuid,
    name: item.name,
    quantity: item.quantity,
    unitValue: 0,
    totalValue: 0,
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
    demand: 0,
    capacity: 0,
    effectiveCapacity: 0,
    consumers: [] as RuleParticipant[],
    providers: [] as RuleParticipant[],
    failingItems: [] as RuleParticipant[],
    suggestions: [] as RuleSuggestion[],
    bins: [] as ProviderBin[],
  };

  const consumers = selection.filter(
    (item) =>
      parseSpecValues(item.attributes[rule.consumerSpec.key]).length > 0 &&
      matchesCondition(item, rule.condition),
  );
  if (consumers.length === 0) {
    return {
      ...base,
      status: "not_applicable",
      message: `Nothing in the selection carries "${rule.consumerSpec.label}" — rule does not apply.`,
    };
  }

  const providers = selection.filter(
    (item) => parseSpecValues(item.attributes[rule.providerSpec.key]).length > 0,
  );
  base.consumers = consumers.map(participant);
  base.providers = providers.map(participant);

  if (providers.length === 0) {
    return {
      ...base,
      status: "not_applicable",
      message: `Nothing in the selection carries "${rule.providerSpec.label}" to match against.`,
    };
  }

  const providerValues = [
    ...new Set(
      providers.flatMap((item) =>
        parseSpecValues(item.attributes[rule.providerSpec.key]),
      ),
    ),
  ];

  const failing = consumers.filter(
    (item) =>
      !providers.some((provider) =>
        specMatchSatisfied(
          parseSpecValues(item.attributes[rule.consumerSpec.key]),
          parseSpecValues(provider.attributes[rule.providerSpec.key]),
          rule,
        ),
      ),
  );

  const violationStatus: RuleStatus = rule.severity === "warn" ? "warn" : "fail";
  if (failing.length === 0) {
    return {
      ...base,
      status: "pass",
      message: `Every item's "${rule.consumerSpec.label}" is compatible with "${rule.providerSpec.label}".`,
    };
  }
  return {
    ...base,
    status: violationStatus,
    failingItems: failing.map(participant),
    message: `${failing.length} item(s) have a "${rule.consumerSpec.label}" not compatible with the available "${rule.providerSpec.label}" (${providerValues.join(", ") || "none"}): ${failing.map((item) => item.name).join(", ")}.`,
  };
};

// The first lookup row every one of whose `when` entries matches the item's
// own spec values, or null when the table has no row for this combination.
// Rows are tried in author order, so a more specific row can be listed above a
// catch-all.
const matchLookupRow = (
  lookup: LookupTable,
  attributes: EngineItem["attributes"],
) =>
  lookup.rows.find((row) =>
    Object.entries(row.when).every(([key, wanted]) =>
      parseSpecValues(attributes[key]).includes(wanted),
    ),
  ) ?? null;

// The Conditional family. The limit is not supplied by another product — it is
// read from the rule's own table, keyed by the item's other spec values. Max
// cable run is the canonical case: Cat6 at 10G runs 55 m, Cat6a at 10G runs
// 100 m, so the same measured length passes or fails depending on the grade
// and speed of the very same item.
const evaluateConditional = (
  rule: EngineRule,
  selection: EngineItem[],
): RuleEvaluation => {
  const participant = (item: EngineItem, unitValue: number): RuleParticipant => ({
    productUuid: item.productUuid,
    name: item.name,
    quantity: item.quantity,
    unitValue,
    totalValue: round2(unitValue * item.quantity),
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
    unit: rule.consumerSpec.unit,
    demand: 0,
    capacity: 0,
    effectiveCapacity: 0,
    consumers: [] as RuleParticipant[],
    providers: [] as RuleParticipant[],
    failingItems: [] as RuleParticipant[],
    suggestions: [] as RuleSuggestion[],
    bins: [] as ProviderBin[],
  };

  const lookup = rule.lookup;
  if (!lookup || lookup.rows.length === 0) {
    return {
      ...base,
      status: "not_applicable",
      message: `"${rule.name}" has no lookup table to read a limit from.`,
    };
  }

  // Only items that carry the measured spec AND match a row participate. An
  // item with no matching row is outside what the table describes, which is a
  // gap in the table rather than a failure by the item.
  const judged = selection.flatMap((item) => {
    const unitValue = numericValue(item.attributes, rule.consumerSpec.key, "max");
    if (unitValue === null || !matchesCondition(item, rule.condition)) {
      return [];
    }
    const row = matchLookupRow(lookup, item.attributes);
    if (!row) {
      return [];
    }
    return [{ item, unitValue, limit: row.limit, when: row.when }];
  });

  if (judged.length === 0) {
    return {
      ...base,
      status: "not_applicable",
      message: `Nothing in the selection carries "${rule.consumerSpec.label}" with a combination this table covers — rule does not apply.`,
    };
  }

  const describe = (when: Record<string, string>): string =>
    Object.values(when).join(" · ");

  const failing = judged.filter(
    ({ unitValue, limit }) =>
      !compare(
        unitValue,
        round2((limit * rule.headroomPercent) / 100),
        rule.comparator,
      ),
  );

  const consumers = judged.map(({ item, unitValue }) =>
    participant(item, unitValue),
  );
  const worst = Math.max(...judged.map(({ unitValue }) => unitValue));
  const tightest = Math.min(...judged.map(({ limit }) => limit));
  const violationStatus: RuleStatus = rule.severity === "warn" ? "warn" : "fail";

  if (failing.length === 0) {
    return {
      ...base,
      status: "pass",
      consumers,
      demand: worst,
      capacity: tightest,
      effectiveCapacity: round2((tightest * rule.headroomPercent) / 100),
      message: `Every item's "${rule.consumerSpec.label}" is within the limit its own configuration allows (tightest: ${formatValue(tightest, rule.consumerSpec.unit)}).`,
    };
  }

  return {
    ...base,
    status: violationStatus,
    consumers,
    demand: worst,
    capacity: tightest,
    effectiveCapacity: round2((tightest * rule.headroomPercent) / 100),
    failingItems: failing.map(({ item, unitValue }) =>
      participant(item, unitValue),
    ),
    message: `${failing.length} item(s) exceed the limit their configuration allows: ${failing
      .map(
        ({ item, unitValue, limit, when }) =>
          `${item.name} (${describe(when)} allows ${formatValue(limit, rule.consumerSpec.unit)}, has ${formatValue(unitValue, rule.consumerSpec.unit)})`,
      )
      .join(", ")}.`,
  };
};

/** Evaluate one rule against a selection — pure, no I/O. */
export const evaluateRule = (
  rule: EngineRule,
  selection: EngineItem[],
  catalog: EngineCatalogProduct[],
  variables: VariableContext = {},
): RuleEvaluation => {
  // The Match-on-select family has its own set-comparison path.
  if (rule.kind === "spec_match") {
    return evaluateSpecMatch(rule, selection);
  }
  // The Conditional family reads its limit from a table, not from a provider.
  if (rule.kind === "conditional") {
    return evaluateConditional(rule, selection);
  }

  // A project variable contributes one value for the whole design, not one per
  // item — the answer to "how many concurrent calls" doesn't multiply by how
  // many phones are in the cart.
  const variableParticipant = (spec: EngineSpec): RuleParticipant[] => {
    const value = variables[spec.key];
    if (value === undefined || !Number.isFinite(value)) {
      return [];
    }
    return [
      {
        productUuid: "",
        name: `${spec.label} (project variable)`,
        quantity: 1,
        unitValue: value,
        totalValue: round2(value),
      },
    ];
  };

  const consumers: RuleParticipant[] = rule.consumerSpec.isVariable
    ? variableParticipant(rule.consumerSpec)
    : selection.flatMap((item) => {
        const unitValue = numericValue(
          item.attributes,
          rule.consumerSpec.key,
          "max",
        );
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

  const providers: RuleParticipant[] = rule.providerSpec.isVariable
    ? variableParticipant(rule.providerSpec)
    : selection.flatMap((item) => {
        const unitValue = numericValue(
          item.attributes,
          rule.providerSpec.key,
          "min",
        );
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
    bins: [] as ProviderBin[],
  };

  if (consumers.length === 0) {
    return {
      ...base,
      status: "not_applicable",
      demand: 0,
      capacity: 0,
      effectiveCapacity: 0,
      message: rule.consumerSpec.isVariable
        ? `This design hasn't answered "${rule.consumerSpec.label}" — rule does not apply until it does.`
        : `Nothing in the selection carries "${rule.consumerSpec.label}" — rule does not apply.`,
    };
  }

  const violationStatus: RuleStatus = rule.severity === "warn" ? "warn" : "fail";

  // Demand per kind: what the consumers collectively (or individually) ask of
  // the provider capacity. A variable is the design's single answer, so it is
  // read as-is — counting it would just count the one variable.
  const demand = rule.consumerSpec.isVariable
    ? round2(consumers[0].totalValue)
    : rule.kind === "count_limit"
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

  // Ratio: demand ÷ supply must stay within the target contention ratio
  // (e.g. uplink oversubscription). A designed derating, not a hard sum.
  if (rule.kind === "ratio") {
    const supply = capacity;
    const target = Number(rule.ratioLimit ?? 0);
    const actual = supply > 0 ? round2(demand / supply) : Infinity;
    const pass = target > 0 && actual <= target;
    const actualLabel = Number.isFinite(actual) ? `${actual}:1` : "∞";
    return {
      ...base,
      status: pass ? "pass" : violationStatus,
      demand,
      capacity: supply,
      effectiveCapacity: target,
      message: pass
        ? `Contention ${actualLabel} is within the target ${target}:1 (${formatValue(demand, rule.consumerSpec.unit)} demand ÷ ${formatValue(supply, rule.providerSpec.unit)} supply).`
        : `Contention ${actualLabel} exceeds the target ${target}:1 — add supply or reduce demand.`,
    };
  }

  // Per-provider allocation: each provider unit is its own bin; consumers are
  // distributed by first-fit-decreasing and every unit must fit its share.
  // Only meaningful for "must fit within" — other comparators stay pooled.
  if (rule.allocation === "per_provider" && rule.comparator === "lte") {
    const bins: ProviderBin[] = providers.flatMap((provider) =>
      Array.from({ length: provider.quantity }, (_, index) => ({
        productUuid: provider.productUuid,
        name: provider.name,
        unitIndex: index + 1,
        capacity: round2((provider.unitValue * rule.headroomPercent) / 100),
        used: 0,
        items: [],
      })),
    );

    // One entry per physical consumer unit, largest first (FFD). Count rules
    // occupy one slot per unit; sum rules occupy their own value.
    const units = consumers
      .flatMap((consumer) =>
        Array.from({ length: consumer.quantity }, () => ({
          productUuid: consumer.productUuid,
          name: consumer.name,
          size: rule.kind === "count_limit" ? 1 : consumer.unitValue,
        })),
      )
      .sort((a, b) => b.size - a.size);

    const unplacedByProduct = new Map<string, RuleParticipant>();
    for (const unit of units) {
      const bin = bins.find(
        (candidate) => candidate.used + unit.size <= candidate.capacity + 1e-9,
      );
      if (!bin) {
        const existing = unplacedByProduct.get(unit.productUuid);
        if (existing) {
          existing.quantity += 1;
          existing.totalValue = round2(existing.totalValue + unit.size);
        } else {
          unplacedByProduct.set(unit.productUuid, {
            productUuid: unit.productUuid,
            name: unit.name,
            quantity: 1,
            unitValue: unit.size,
            totalValue: unit.size,
          });
        }
        continue;
      }
      bin.used = round2(bin.used + unit.size);
      const entry = bin.items.find(
        (item) => item.productUuid === unit.productUuid,
      );
      if (entry) {
        entry.count += 1;
      } else {
        bin.items.push({
          productUuid: unit.productUuid,
          name: unit.name,
          count: 1,
          unitValue: unit.size,
        });
      }
    }

    const unplaced = [...unplacedByProduct.values()];
    const unitWord = rule.kind === "count_limit" ? "slot(s)" : "";

    if (unplaced.length === 0) {
      return {
        ...base,
        status: "pass",
        demand,
        capacity,
        effectiveCapacity: effective,
        bins,
        message: `Everything fits: distributed across ${bins.length} provider unit(s), each within its own capacity.`,
      };
    }

    const leftoverCount = unplaced.reduce((sum, item) => sum + item.quantity, 0);
    const largest = Math.max(...unplaced.map((item) => item.unitValue));
    return {
      ...base,
      status: violationStatus,
      demand,
      capacity,
      effectiveCapacity: effective,
      bins,
      failingItems: unplaced,
      message: `${leftoverCount} item(s) do not fit on any single provider unit ${unitWord ? `(${unitWord})` : ""}even after distributing across ${bins.length} unit(s): ${unplaced
        .map(
          (item) =>
            `${item.quantity} × ${item.name}${rule.kind === "count_limit" ? "" : ` (${formatValue(item.unitValue, rule.consumerSpec.unit)} each)`}`,
        )
        .join(", ")}.`,
      suggestions: findSuggestions(rule, largest, catalog),
    };
  }
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
    message: `Total "${rule.consumerSpec.label}" of ${demandLabel} ${violationWord(rule.comparator)} the usable "${rule.providerSpec.label}" of ${formatValue(effective, rule.providerSpec.unit)}${headroomNote} — ${gapWord(rule.comparator)} by ${formatValue(gap, rule.providerSpec.unit)}.`,
    suggestions: findSuggestions(rule, demand, catalog),
  };
};

/** Evaluate every rule against a selection — pure, no I/O. */
export const evaluateRules = (
  rules: EngineRule[],
  selection: EngineItem[],
  catalog: EngineCatalogProduct[],
  variables: VariableContext = {},
): CompatibilityReport => {
  const results = rules.map((rule) =>
    evaluateRule(rule, selection, catalog, variables),
  );
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

