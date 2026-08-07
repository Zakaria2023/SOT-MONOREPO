import type {
  MatchMode,
  RelationshipAllocation,
  RelationshipComparator,
  RelationshipFamily,
  RelationshipGate,
} from "../../../db/enum";
import type {
  CorrectionShape,
  FindingCorrection,
  LookupTable,
  Operand,
  Predicate,
  PresenceSpec,
  ProductValue,
  ProductValues,
  RelationshipScope,
  SpecGroupField,
  SpecOption,
  SpecRange,
} from "../../../db/types";
import { operandVariableUuid } from "../../../db/types";
import {
  evaluatePredicate,
  filteredGroupPicks,
  filteredGroupTotal,
} from "./predicate";
import {
  asNumber,
  asOptionList,
  asRange,
  describeValue,
  formatValue,
  groupFieldRank,
  groupSubField,
  hasValue,
  optionLabel,
  optionRank,
  readValue,
  round2,
  unitFactor,
  type AttributeIndex,
  type AttributeMeta,
  type RangeBound,
} from "./spec-values";

// ---------------------------------------------------------------------------
// THE RELATIONSHIP ENGINE. Deterministic, pure, no I/O, no language model.
//
// It takes rule rows, a selection, and the library, then resolves participants,
// aggregates, compares, and explains. It knows nothing about PoE, cameras or
// switches — all meaning lives in the data.
//
// Two invariants it will not break:
//
//   1. It NEVER guesses. If a value is missing or two units do not convert, the
//      rule reports UNKNOWN and names what it could not read. A missing value
//      must never look like a pass, because incomplete data does not look like
//      an error to a buyer — it looks like approval.
//   2. Presence owns "what is missing"; every other family owns "what
//      conflicts". So a selection with cameras and no switch produces exactly
//      one finding, not two saying the same thing in different words.
// ---------------------------------------------------------------------------

export type SelectionInput = {
  productUuid: string;
  quantity: number;
};

export type EngineItem = {
  productUuid: string;
  name: string;
  quantity: number;
  values: ProductValues;
  // Attribute uuids this item's CATEGORY says the engine reads — the ones its
  // assignments marked `isRule`.
  //
  // This is how a blank is told apart from an absence. Without it, a camera with
  // no operating power looks exactly like a switch that has no operating power
  // to give: both just "do not carry the attribute", and the camera is dropped
  // from the budget check in silence. With it, the camera is reported as
  // unreadable and the switch is correctly left out.
  //
  // Optional because a caller may genuinely not know (a fixture, an ad-hoc
  // check). Absent means "no expectation recorded", never "expects nothing".
  expects?: string[];
  // The item's own category, then each ancestor. What a product-group condition
  // matches against — see PredicateSubject.
  categoryChain?: string[];
};

export type EngineCatalogProduct = {
  productUuid: string;
  name: string;
  values: ProductValues;
  categoryChain?: string[];
};

// A project input the buyer supplied. `value` is null when unanswered — and a
// rule needing an unanswered variable does not run, rather than running on a
// number nobody provided.
export type EngineVariable = {
  uuid: string;
  label: string;
  unit: string | null;
  value: number | boolean | null;
};

export type EngineRelationship = {
  uuid: string;
  name: string;
  description: string | null;
  family: RelationshipFamily;
  gate: RelationshipGate;
  comparator: RelationshipComparator;
  matchMode: MatchMode;
  headroomPercent: number;
  ratioLimit: number | null;
  allocation: RelationshipAllocation;
  perItem: boolean;
  consumer: Operand | null;
  provider: Operand | null;
  consumerWhen: Predicate | null;
  providerWhen: Predicate | null;
  lookup: LookupTable | null;
  presence: PresenceSpec | null;
  scope: RelationshipScope | null;
};

export type EngineContext = {
  attributes: AttributeIndex;
  variables: Map<string, EngineVariable>;
  catalog: EngineCatalogProduct[];
  // The market the selection is being priced for, matched against a rule's
  // scope. Undefined = run every rule regardless of scope.
  region?: string;
};

// pass        — checked and satisfied
// warn        — violated, and the rule only cautions
// block       — violated, and the rule gates checkout
// not_applicable — nothing in the selection participates
// unknown     — could not be checked. Never treated as a pass.
export type FindingStatus =
  "pass" | "warn" | "block" | "not_applicable" | "unknown";

export type Participant = {
  productUuid: string;
  name: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
};

// One physical provider unit (e.g. switch #2 of 3) and what was placed in it.
export type ProviderBin = {
  productUuid: string;
  name: string;
  unitIndex: number;
  capacity: number;
  used: number;
  items: { productUuid: string; name: string; count: number; size: number }[];
};

export type SkippedItem = {
  productUuid: string;
  name: string;
  // Attribute labels the engine needed and could not read.
  missing: string[];
};

export type Finding = {
  relationshipUuid: string;
  name: string;
  description: string | null;
  family: RelationshipFamily;
  gate: RelationshipGate;
  status: FindingStatus;
  // One sentence, with the numbers in it. "Incompatible" is useless; the buyer
  // needs to see both sides and the gap.
  message: string;
  demand: number;
  capacity: number;
  effectiveCapacity: number;
  unit: string | null;
  consumers: Participant[];
  providers: Participant[];
  failingItems: Participant[];
  bins: ProviderBin[];
  // Items that matched but could not be judged — the honest half of Q40.
  skipped: SkippedItem[];
  corrections: FindingCorrection[];
};

export type DesignReport = {
  findings: Finding[];
  blockers: Finding[];
  warnings: Finding[];
  // Rules that could not be evaluated. Surfaced, never swallowed.
  unknowns: Finding[];
  passed: number;
  notApplicable: number;
};

// ---------------------------------------------------------------------------
// Operands
// ---------------------------------------------------------------------------

const operandMeta = (
  operand: Operand | null,
  context: EngineContext,
): AttributeMeta | null => {
  if (!operand || operand.source !== "spec") {
    return null;
  }
  return context.attributes.get(operand.specUuid) ?? null;
};

// The sub-field an operand names, when it names one and the attribute really is a
// group. Null for every other operand, so the callers below stay one-line.
const operandSubField = (
  operand: Operand | null,
  context: EngineContext,
): SpecGroupField | null => {
  if (!operand || operand.source !== "spec" || !operand.groupField) {
    return null;
  }
  const meta = operandMeta(operand, context);
  return meta ? groupSubField(meta, operand.groupField) : null;
};

const operandUnit = (
  operand: Operand | null,
  context: EngineContext,
): string | null => {
  if (!operand) {
    return null;
  }
  if (operand.source === "spec") {
    // The SUB-FIELD's unit when one is named, never the attribute's. A group
    // carries no unit of its own — the count of ports and a per-port wattage are
    // different dimensions living in the same attribute, and reading the wrong one
    // is how a comparison passes a check it should have failed.
    const subField = operandSubField(operand, context);
    if (subField) {
      return subField.unit;
    }
    return operandMeta(operand, context)?.unit ?? null;
  }
  if (operand.source === "variable") {
    return context.variables.get(operand.variableUuid)?.unit ?? null;
  }
  return null;
};

const operandLabel = (
  operand: Operand | null,
  context: EngineContext,
): string => {
  if (!operand) {
    return "—";
  }
  if (operand.source === "spec") {
    const label = operandMeta(operand, context)?.label;
    if (!label) {
      return "a deleted attribute";
    }
    // "Network Ports · Ports", so a finding names the column it actually counted
    // rather than the attribute it came from.
    const subField = operandSubField(operand, context);
    if (!subField) {
      return label;
    }
    // And "(matching rows only)" when a filter narrowed them, because otherwise a
    // finding reading "8 of 24 ports" against a rule that only ever counted the
    // 10G ones is a number the author cannot reconcile with the product in front
    // of them.
    const narrowed =
      operand.source === "spec" && operand.where ? " (matching rows only)" : "";
    return `${label} · ${subField.label}${narrowed}`;
  }
  if (operand.source === "variable") {
    return (
      context.variables.get(operand.variableUuid)?.label ?? "a deleted input"
    );
  }
  if (operand.source === "item_count") {
    return "item count";
  }
  return `${operand.value}`;
};

// The per-unit number an item contributes on this side, or null when the item
// carries no readable value for it.
const itemOperandValue = (
  operand: Operand,
  item: EngineItem,
  context: EngineContext,
  bound: RangeBound,
): number | null => {
  if (operand.source === "constant") {
    return operand.value;
  }
  if (operand.source === "item_count") {
    return 1;
  }
  if (operand.source === "variable") {
    const variable = context.variables.get(operand.variableUuid);
    return typeof variable?.value === "number" ? variable.value : null;
  }
  const meta = context.attributes.get(operand.specUuid);
  if (!meta) {
    return null;
  }
  const raw = readValue(item.values, operand.specUuid);
  // A group has no single magnitude, so `asNumber` returns null for one on
  // purpose. The operand has to name which column to total — Σ(count) over the
  // port groups, not the number of groups, which is the plausible wrong answer
  // (4 instead of 50) that nothing would have reported.
  //
  // Rows that do not answer the current schema are excluded there, so a
  // switch whose ports became unreadable reads as null here and is reported as a
  // gap rather than counted short. Completeness names the same rows.
  if (operand.groupField) {
    return filteredGroupTotal(raw, meta, operand.groupField, operand.where);
  }
  return asNumber(raw, meta, bound);
};

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

type Side = {
  participants: Participant[];
  skipped: SkippedItem[];
  // Items that matched the side's filter at all — used to tell "nothing
  // participates" apart from "everything that participates is unreadable".
  matched: number;
};

const collectSide = (
  operand: Operand | null,
  when: Predicate | null,
  selection: EngineItem[],
  context: EngineContext,
  // Which end of a span this side reads. The consumer side takes "max" and the
  // provider side "min", so a span always costs its worst case and only ever
  // promises its guaranteed one.
  bound: RangeBound,
): Side => {
  const participants: Participant[] = [];
  const skipped: SkippedItem[] = [];
  let matched = 0;

  if (!operand) {
    return { participants, skipped, matched };
  }

  for (const item of selection) {
    const filter = evaluatePredicate(when, item.values, context.attributes, {
      categoryChain: item.categoryChain,
    });
    if (!filter.matched) {
      // A filter that failed only because data was missing is a data problem,
      // not a non-match — otherwise an unfilled product quietly drops out of
      // every rule that would have judged it.
      if (filter.missing.length > 0) {
        skipped.push({
          productUuid: item.productUuid,
          name: item.name,
          missing: filter.missing.map(
            (uuid) => context.attributes.get(uuid)?.label ?? uuid,
          ),
        });
      }
      continue;
    }

    // A missing operand value is either "this item is not part of this rule" or
    // "somebody forgot to fill this in", and the two must not be confused — the
    // second one is how a camera with a blank power draw silently passes every
    // budget check.
    //
    // TWO things tell them apart, and either is enough:
    //
    //   The side's FILTER. If the rule said "consumers are items whose role is
    //   Camera" and this item matched that, it was supposed to carry a draw.
    //
    //   The item's own CATEGORY. If its assignments marked this attribute as one
    //   the engine reads, then every product in that category owes a value, and
    //   a blank is a gap no matter what the rule asked for.
    //
    // The second is what carries this now that a rule need not have a filter at
    // all. Neither holding means participation is defined purely by carrying the
    // attribute — a switch has no camera resolution and genuinely is not a
    // participant.
    if (operand.source === "spec") {
      const raw = readValue(item.values, operand.specUuid);
      if (!hasValue(raw)) {
        if (when || item.expects?.includes(operand.specUuid)) {
          skipped.push({
            productUuid: item.productUuid,
            name: item.name,
            missing: [operandLabel(operand, context)],
          });
        }
        continue;
      }
    }

    matched += 1;
    const unitValue = itemOperandValue(operand, item, context, bound);
    if (unitValue === null) {
      skipped.push({
        productUuid: item.productUuid,
        name: item.name,
        missing: [operandLabel(operand, context)],
      });
      continue;
    }
    participants.push({
      productUuid: item.productUuid,
      name: item.name,
      quantity: item.quantity,
      unitValue,
      totalValue: round2(unitValue * item.quantity),
    });
  }

  return { participants, skipped, matched };
};

// ---------------------------------------------------------------------------
// Finding scaffolding
// ---------------------------------------------------------------------------

const emptyFinding = (
  rule: EngineRelationship,
  unit: string | null,
): Omit<Finding, "status" | "message"> => ({
  relationshipUuid: rule.uuid,
  name: rule.name,
  description: rule.description,
  family: rule.family,
  gate: rule.gate,
  demand: 0,
  capacity: 0,
  effectiveCapacity: 0,
  unit,
  consumers: [],
  providers: [],
  failingItems: [],
  bins: [],
  skipped: [],
  corrections: [],
});

const violation = (rule: EngineRelationship): FindingStatus =>
  rule.gate === "warn" ? "warn" : "block";

const correction = (
  shape: CorrectionShape,
  message: string,
  products: FindingCorrection["products"] = [],
): FindingCorrection => ({ shape, message, products });

/**
 * Catalog products that would satisfy the failed demand on their own, smallest
 * sufficient capacity first.
 *
 * Only offered for a capacity comparison, where "bigger number" is a real fix.
 * For a compatibility mismatch there is no arithmetic to search on, so the
 * correction describes the swap instead of guessing at a product.
 */
const suggestProviders = (
  rule: EngineRelationship,
  demand: number,
  context: EngineContext,
): FindingCorrection["products"] => {
  const operand = rule.provider;
  if (!operand || operand.source !== "spec" || rule.comparator === "gte") {
    return [];
  }
  const meta = context.attributes.get(operand.specUuid);
  if (!meta) {
    return [];
  }
  return context.catalog
    .flatMap((product) => {
      const filter = evaluatePredicate(
        rule.providerWhen,
        product.values,
        context.attributes,
        { categoryChain: product.categoryChain },
      );
      if (!filter.matched) {
        return [];
      }
      // A suggested replacement is a PROVIDER, so it may only be credited with
      // the capacity it always has — suggesting a 20–30 W part to cover 25 W
      // would be recommending something that might not fit.
      //
      // A group's capacity is the total of the named column, read the same way the
      // participants were. Reading it any other way here would suggest products
      // the rule would then reject.
      const raw = readValue(product.values, operand.specUuid);
      const capacity = operand.groupField
        ? filteredGroupTotal(raw, meta, operand.groupField, operand.where)
        : asNumber(raw, meta, "min");
      if (capacity === null) {
        return [];
      }
      const usable = round2((capacity * rule.headroomPercent) / 100);
      return usable >= demand
        ? [{ productUuid: product.productUuid, name: product.name, capacity }]
        : [];
    })
    .sort((a, b) => a.capacity - b.capacity)
    .slice(0, 3);
};

// ---------------------------------------------------------------------------
// Capacity, pooled or per unit
// ---------------------------------------------------------------------------

type Packing = {
  bins: ProviderBin[];
  unplaced: Participant[];
};

/**
 * Distribute consumer units across provider units, first-fit-decreasing.
 *
 * The default, because two switches with 130 W each are NOT one switch with
 * 260 W: pooling would approve a design where a single 200 W load cannot
 * physically attach to either of them.
 */
const packPerUnit = (
  consumers: Participant[],
  providers: Participant[],
  headroomPercent: number,
): Packing => {
  const bins: ProviderBin[] = providers.flatMap((provider) =>
    Array.from({ length: Math.max(1, provider.quantity) }, (_, index) => ({
      productUuid: provider.productUuid,
      name: provider.name,
      unitIndex: index + 1,
      capacity: round2((provider.unitValue * headroomPercent) / 100),
      used: 0,
      items: [] as ProviderBin["items"],
    })),
  );

  const units = consumers
    .flatMap((consumer) =>
      Array.from({ length: Math.max(1, consumer.quantity) }, () => ({
        productUuid: consumer.productUuid,
        name: consumer.name,
        size: consumer.unitValue,
      })),
    )
    .sort((a, b) => b.size - a.size);

  const unplacedByProduct = new Map<string, Participant>();

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
        size: unit.size,
      });
    }
  }

  return { bins, unplaced: [...unplacedByProduct.values()] };
};

const compare = (
  demand: number,
  limit: number,
  comparator: RelationshipComparator,
): boolean => {
  if (comparator === "gte") {
    return demand >= limit;
  }
  if (comparator === "eq") {
    return demand === limit;
  }
  return demand <= limit;
};

// ---------------------------------------------------------------------------
// Budget and Count
// ---------------------------------------------------------------------------

const evaluateCapacity = (
  rule: EngineRelationship,
  selection: EngineItem[],
  context: EngineContext,
): Finding => {
  const consumerUnit = operandUnit(rule.consumer, context);
  const providerUnit = operandUnit(rule.provider, context);
  const base = emptyFinding(rule, providerUnit);

  const consumerSide = collectSide(
    rule.consumer,
    rule.consumerWhen,
    selection,
    context,
    "max",
  );
  const providerSide = collectSide(
    rule.provider,
    rule.providerWhen,
    selection,
    context,
    "min",
  );
  const skipped = [...consumerSide.skipped, ...providerSide.skipped];

  if (consumerSide.participants.length === 0) {
    // Everything that would have participated is unreadable — that is a data
    // problem the catalog team has to see, not a rule that does not apply.
    if (consumerSide.skipped.length > 0) {
      return {
        ...base,
        skipped,
        status: "unknown",
        message: `Could not check "${rule.name}": ${describeSkipped(consumerSide.skipped)}`,
      };
    }
    return {
      ...base,
      skipped,
      status: "not_applicable",
      message: `Nothing in the selection carries "${operandLabel(rule.consumer, context)}" — this check does not apply.`,
    };
  }

  // Unit safety before any arithmetic. An item count is deliberately
  // dimensionless, so a Count rule compares it against the provider's own unit
  // without conversion.
  let toProvider = 1;
  if (rule.consumer?.source !== "item_count") {
    const conversion = unitFactor(consumerUnit, providerUnit);
    if (!conversion.ok) {
      return {
        ...base,
        skipped,
        status: "unknown",
        message: `Could not check "${rule.name}": ${conversion.reason}. Fix the units in the library before this rule can run.`,
      };
    }
    toProvider = conversion.factor;
  }

  const consumers = consumerSide.participants.map((participant) => ({
    ...participant,
    unitValue: round2(participant.unitValue * toProvider),
    totalValue: round2(
      participant.unitValue * toProvider * participant.quantity,
    ),
  }));
  const providers = providerSide.participants;

  const demand = round2(
    consumers.reduce((sum, consumer) => sum + consumer.totalValue, 0),
  );

  // Q30: an absent provider is Presence's concern, not Budget's. Reporting it
  // here too would show the buyer the same problem twice in different words.
  if (providers.length === 0) {
    if (providerSide.skipped.length > 0) {
      return {
        ...base,
        consumers,
        skipped,
        status: "unknown",
        message: `Could not check "${rule.name}": ${describeSkipped(providerSide.skipped)}`,
      };
    }
    return {
      ...base,
      consumers,
      demand,
      skipped,
      status: "not_applicable",
      message: `Nothing in the selection supplies "${operandLabel(rule.provider, context)}" — this check does not apply.`,
    };
  }

  const withSides = { ...base, consumers, providers, skipped };
  const consumerName = operandLabel(rule.consumer, context);
  const providerName = operandLabel(rule.provider, context);

  // A count has no unit of its own — it is a number of things. Rendering it with
  // the provider's unit produced "Total item count is 20 ports", which reads as
  // though the cameras were measured in ports.
  const counting = rule.consumer?.source === "item_count";
  const describeDemand = (value: number): string =>
    counting
      ? `${round2(value)} item${round2(value) === 1 ? "" : "s"}`
      : formatValue(value, providerUnit);
  const reduceDemand = counting
    ? "Remove items, or add another device to take them."
    : `Reduce "${consumerName}" by removing items or choosing lower-draw alternatives.`;

  // Budget in per-item mode: each unit against the single best provider value.
  if (rule.perItem) {
    const limit = Math.max(...providers.map((provider) => provider.unitValue));
    const effective = round2((limit * rule.headroomPercent) / 100);
    const failing = consumers.filter(
      (consumer) => !compare(consumer.unitValue, effective, rule.comparator),
    );
    const worst = Math.max(...consumers.map((consumer) => consumer.unitValue));

    if (failing.length === 0) {
      return {
        ...withSides,
        demand: worst,
        capacity: limit,
        effectiveCapacity: effective,
        status: "pass",
        message: `Every item's "${consumerName}" (highest ${formatValue(worst, providerUnit)}) fits the per-device limit of ${formatValue(effective, providerUnit)}.`,
      };
    }
    return {
      ...withSides,
      demand: worst,
      capacity: limit,
      effectiveCapacity: effective,
      failingItems: failing,
      status: violation(rule),
      message: `${failing.length} item(s) exceed the per-device limit of ${formatValue(effective, providerUnit)}: ${failing.map((item) => `${item.name} (${formatValue(item.unitValue, providerUnit)})`).join(", ")}.`,
      corrections: [
        correction(
          "swap",
          `Choose a ${providerName.toLowerCase()} of at least ${formatValue(worst, providerUnit)}, or a lower-draw alternative for the failing item(s).`,
          suggestProviders(rule, worst, context),
        ),
      ],
    };
  }

  const pooledCapacity = round2(
    providers.reduce((sum, provider) => sum + provider.totalValue, 0),
  );
  const pooledEffective = round2((pooledCapacity * rule.headroomPercent) / 100);
  const headroomNote =
    rule.headroomPercent === 100
      ? ""
      : ` (${formatValue(pooledCapacity, providerUnit)} × ${rule.headroomPercent}%)`;

  if (rule.allocation === "per_unit" && rule.comparator === "lte") {
    const { bins, unplaced } = packPerUnit(
      consumers,
      providers,
      rule.headroomPercent,
    );
    if (unplaced.length === 0) {
      return {
        ...withSides,
        demand,
        capacity: pooledCapacity,
        effectiveCapacity: pooledEffective,
        bins,
        status: "pass",
        message: `Everything fits: ${describeDemand(demand)} of "${consumerName}" spread across ${bins.length} device(s), each within its own "${providerName}".`,
      };
    }
    const leftover = unplaced.reduce((sum, item) => sum + item.quantity, 0);
    const largest = Math.max(...unplaced.map((item) => item.unitValue));
    const shortfall = round2(Math.max(0, demand - pooledEffective));

    return {
      ...withSides,
      demand,
      capacity: pooledCapacity,
      effectiveCapacity: pooledEffective,
      bins,
      failingItems: unplaced,
      status: violation(rule),
      message: `${leftover} item(s) do not fit on any single device even after spreading the load across ${bins.length}: ${unplaced.map((item) => `${item.quantity} × ${item.name}`).join(", ")}. Total "${consumerName}" is ${describeDemand(demand)} against a usable "${providerName}" of ${formatValue(pooledEffective, providerUnit)}${headroomNote}.`,
      corrections: [
        correction(
          "add_supply",
          shortfall > 0
            ? `Add at least ${formatValue(shortfall, providerUnit)} more "${providerName}" — another device, or a bigger one.`
            : `Add another device: the total is within budget but no single unit can take the largest item (${formatValue(largest, providerUnit)}).`,
          // Suggest against the SHORTFALL, not the largest leftover item.
          // Searching on the largest item offered a 130 W switch as the example
          // fix for a 110 W shortfall — technically able to hold one camera, and
          // useless as an answer to the sentence above it.
          suggestProviders(rule, Math.max(shortfall, largest), context),
        ),
        correction("reduce_demand", reduceDemand),
      ],
    };
  }

  if (compare(demand, pooledEffective, rule.comparator)) {
    return {
      ...withSides,
      demand,
      capacity: pooledCapacity,
      effectiveCapacity: pooledEffective,
      status: "pass",
      message: `Total "${consumerName}" of ${describeDemand(demand)} fits the usable "${providerName}" of ${formatValue(pooledEffective, providerUnit)}${headroomNote}.`,
    };
  }

  const gap = round2(Math.abs(demand - pooledEffective));
  const over = rule.comparator === "lte";
  return {
    ...withSides,
    demand,
    capacity: pooledCapacity,
    effectiveCapacity: pooledEffective,
    status: violation(rule),
    message: `Total "${consumerName}" of ${describeDemand(demand)} ${over ? "exceeds" : "falls short of"} the usable "${providerName}" of ${formatValue(pooledEffective, providerUnit)}${headroomNote} — ${over ? "over" : "short"} by ${formatValue(gap, providerUnit)}.`,
    corrections: [
      correction(
        "add_supply",
        `Add at least ${formatValue(gap, providerUnit)} more "${providerName}".`,
        suggestProviders(rule, demand, context),
      ),
      correction(
        "reduce_demand",
        counting
          ? reduceDemand
          : `Reduce "${consumerName}" by ${formatValue(gap, providerUnit)}.`,
      ),
    ],
  };
};

const describeSkipped = (skipped: SkippedItem[]): string =>
  skipped
    .slice(0, 3)
    .map((item) => `${item.name} has no value for ${item.missing.join(", ")}`)
    .join("; ");

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

// ONE SIDE of a match, reduced to what the comparators need.
//
// This type exists because a match side is not always an attribute's own value.
// When the operand names a group column — "the families this switch has cages
// for" — the values are that column's picks and the RANKS are the column's own,
// because a `group` attribute has no options of its own to rank against.
//
// Before it existed the match path read `asOptionList(readValue(...))` directly,
// which returns an EMPTY list for group rows by design. A match rule pointed at a
// group therefore judged every consumer against nothing, found nothing
// satisfiable, and — on a `block` rule — stopped every cart in the catalog. It
// looked like a real finding, which is what made it worth a type rather than a
// patch at each of the four call sites.
type MatchSide = {
  // Option values. Empty for a span, which is why `span` is carried alongside
  // rather than derived at the comparator.
  values: string[];
  ordered: boolean;
  // The vocabulary carrying the ranks — the attribute's list, or the group
  // column's.
  options: SpecOption[];
  span: SpecRange | null;
  // Whether this item participates on this side at all. NOT `values.length > 0`:
  // a span has no option values and is still a perfectly readable answer.
  readable: boolean;
  // What a finding calls it — "Network Ports · Family", not "Network Ports".
  label: string;
};

const matchSide = (
  operand: Operand & { source: "spec" },
  values: ProductValues,
  context: EngineContext,
): MatchSide => {
  const meta = operandMeta(operand, context);
  const raw = readValue(values, operand.specUuid);
  const label = operandLabel(operand, context);
  if (!meta) {
    return {
      values: [],
      ordered: false,
      options: [],
      span: null,
      readable: false,
      label,
    };
  }

  const subField = operandSubField(operand, context);
  if (subField && operand.groupField) {
    const picks = filteredGroupPicks(
      raw,
      meta,
      operand.groupField,
      operand.where,
    );
    const ranks = picks
      .map((value) => groupFieldRank(subField, value))
      .filter((rank): rank is number => rank !== null);
    return {
      values: picks,
      ordered: subField.ordered,
      options: subField.options,
      // An ordered column spans its own picks, so a 1G/10G switch reads as
      // [1G, 10G] and `within` works on a group exactly as it does elsewhere.
      span:
        subField.ordered && ranks.length > 0
          ? { min: Math.min(...ranks), max: Math.max(...ranks) }
          : null,
      readable: picks.length > 0,
      label,
    };
  }

  return {
    values: asOptionList(raw),
    ordered: meta.ordered,
    options: meta.options,
    span: asSpan(raw, meta),
    // The plain case, and identical to the old `hasValue` test for every type
    // that reaches it — a select yields its picks, a number yields one entry, a
    // span yields a span.
    readable: hasValue(raw),
    label,
  };
};

/**
 * A value's position on the scale, taking either side's vocabulary.
 *
 * Both sides are tried because two attributes sharing a vocabulary resolve the
 * same options, and a value one side does not carry may still be rankable by the
 * other — which is exactly the case a shared option set exists to create.
 */
const scaleRank = (
  value: string,
  vocabularies: SpecOption[][],
): number | null => {
  for (const options of vocabularies) {
    const option = options.find((entry) => entry.value === value);
    if (option && option.rank !== null) {
      return option.rank;
    }
  }
  return null;
};

/**
 * One side as a numeric span, or null when it has no magnitude.
 *
 * A single number is the degenerate span [v, v], which is what lets `within` read
 * the same whether the side holds one value or two. An ORDERED select becomes its
 * rank span, so "the module's speed must fall within the cage's supported range"
 * works on a dropdown as well as on a number.
 */
const asSpan = (
  raw: ProductValue | undefined,
  meta: AttributeMeta | null,
): SpecRange | null => {
  const span = asRange(raw);
  if (span) {
    return span;
  }
  if (typeof raw === "number") {
    return { min: raw, max: raw };
  }
  if (meta?.ordered) {
    const ranks = asOptionList(raw)
      .map((value) => optionRank(meta, value))
      .filter((rank): rank is number => rank !== null);
    if (ranks.length > 0) {
      return { min: Math.min(...ranks), max: Math.max(...ranks) };
    }
  }
  return null;
};

/**
 * Whether a consumer's value(s) fit a provider's.
 *
 *   in         — consumer ⊆ provider  (an impedance the amp supports)
 *   intersects — the sets overlap     (two codec lists sharing one codec)
 *   lte / gte  — position on the scale (an af device fits an at switch, but not
 *                the reverse)
 *   eq         — the two sets are identical
 *   within     — the consumer's whole span sits inside the provider's
 */
const matchSatisfied = (
  consumerSide: MatchSide,
  providerSide: MatchSide,
  rule: EngineRelationship,
): boolean => {
  // `within` is about magnitude, not membership, so it is answered before the
  // values are flattened into option lists — a span flattens to nothing (see
  // `asOptionList`), which is exactly why the set comparators cannot express it.
  if (rule.comparator === "within") {
    const consumerSpan = consumerSide.span;
    const providerSpan = providerSide.span;
    if (!consumerSpan || !providerSpan) {
      return false;
    }
    return (
      consumerSpan.min >= providerSpan.min &&
      consumerSpan.max <= providerSpan.max
    );
  }

  const consumerValues = consumerSide.values;
  const providerValues = providerSide.values;
  const provider = new Set(providerValues);

  if (rule.comparator === "intersects") {
    return consumerValues.some((value) => provider.has(value));
  }
  if (rule.comparator === "in") {
    if (consumerValues.length === 0) {
      return false;
    }
    return rule.matchMode === "any"
      ? consumerValues.some((value) => provider.has(value))
      : consumerValues.every((value) => provider.has(value));
  }
  if (
    rule.comparator === "lte" ||
    rule.comparator === "gte" ||
    rule.comparator === "lt" ||
    rule.comparator === "gt"
  ) {
    // STRICT comparisons exist for one job: saying that two rungs are not the
    // same rung. "A 1G module in a 10G cage runs at 1G" is a fact worth telling
    // the buyer, and it is only true when the module is genuinely below the cage
    // — `lte` would say it about a correctly matched pair too, and a warning that
    // fires on the right answer is a warning people learn to ignore.
    const strict = rule.comparator === "lt" || rule.comparator === "gt";
    // Which way the consumer has to sit relative to the provider.
    const below = rule.comparator === "lte" || rule.comparator === "lt";

    // A ceiling comparison is only meaningful on a scale. An unordered list has
    // no "at most", so it degrades to plain membership rather than silently
    // comparing alphabetical position.
    if (!consumerSide.ordered && !providerSide.ordered) {
      // There is no membership reading of "strictly below" — authoring refuses
      // this pairing, and reaching it means the scale was turned off afterwards.
      if (strict) {
        return false;
      }
      return (
        consumerValues.length > 0 &&
        consumerValues.every((value) => provider.has(value))
      );
    }
    const vocabularies = [providerSide.options, consumerSide.options];
    const providerRanks = providerValues
      .map((value) => scaleRank(value, vocabularies))
      .filter((rank): rank is number => rank !== null);
    const consumerRanks = consumerValues
      .map((value) => scaleRank(value, vocabularies))
      .filter((rank): rank is number => rank !== null);
    if (providerRanks.length === 0 || consumerRanks.length === 0) {
      return false;
    }
    // The provider offers its best rung: the highest it supports when the
    // consumer must sit below it, the lowest it requires when it must sit above.
    const best = below
      ? Math.max(...providerRanks)
      : Math.min(...providerRanks);
    return consumerRanks.every((rank) => {
      if (below) {
        return strict ? rank < best : rank <= best;
      }
      return strict ? rank > best : rank >= best;
    });
  }

  const consumer = new Set(consumerValues);
  return (
    consumer.size === provider.size &&
    [...consumer].every((value) => provider.has(value))
  );
};

const evaluateMatch = (
  rule: EngineRelationship,
  selection: EngineItem[],
  context: EngineContext,
): Finding => {
  const base = emptyFinding(rule, null);
  const consumerOperand = rule.consumer;
  const providerOperand = rule.provider;

  if (
    !consumerOperand ||
    consumerOperand.source !== "spec" ||
    !providerOperand ||
    providerOperand.source !== "spec"
  ) {
    return {
      ...base,
      status: "unknown",
      message: `"${rule.name}" compares values, so both sides must be attributes.`,
    };
  }

  const consumerMeta = context.attributes.get(consumerOperand.specUuid) ?? null;
  const providerMeta = context.attributes.get(providerOperand.specUuid) ?? null;
  if (!consumerMeta || !providerMeta) {
    return {
      ...base,
      status: "unknown",
      message: `"${rule.name}" refers to an attribute that no longer exists.`,
    };
  }

  const participant = (item: EngineItem): Participant => ({
    productUuid: item.productUuid,
    name: item.name,
    quantity: item.quantity,
    unitValue: 0,
    totalValue: 0,
  });

  // Each item reduced to its side ONCE. Reading it per comparison instead would
  // re-filter every group's rows for every consumer/provider pair, which is the
  // quadratic allocation this engine deliberately avoids.
  const sideFor = (
    operand: Operand & { source: "spec" },
    items: EngineItem[],
  ): { item: EngineItem; side: MatchSide }[] =>
    items
      .map((item) => ({ item, side: matchSide(operand, item.values, context) }))
      .filter((entry) => entry.side.readable);

  const consumers = sideFor(
    consumerOperand,
    selection.filter(
      (item) =>
        evaluatePredicate(rule.consumerWhen, item.values, context.attributes, {
          categoryChain: item.categoryChain,
        }).matched,
    ),
  );
  // The operand's label, not the attribute's — a rule reading one column of a
  // group has to say which column, or "Nothing carries Network Ports" is said
  // about a switch that plainly has ports.
  const consumerLabel = operandLabel(consumerOperand, context);
  const providerLabel = operandLabel(providerOperand, context);

  if (consumers.length === 0) {
    return {
      ...base,
      status: "not_applicable",
      message: `Nothing in the selection carries "${consumerLabel}" — this check does not apply.`,
    };
  }

  const providers = sideFor(
    providerOperand,
    selection.filter(
      (item) =>
        evaluatePredicate(rule.providerWhen, item.values, context.attributes, {
          categoryChain: item.categoryChain,
        }).matched,
    ),
  );
  const withSides = {
    ...base,
    consumers: consumers.map((entry) => participant(entry.item)),
    providers: providers.map((entry) => participant(entry.item)),
  };

  if (providers.length === 0) {
    return {
      ...withSides,
      status: "not_applicable",
      message: `Nothing in the selection carries "${providerLabel}" to match against.`,
    };
  }

  // A SPAN under a set comparator is unreadable, not unsatisfied.
  //
  // `asOptionList` flattens a span to nothing on purpose — stringifying it would
  // hand the set operators "[object Object]" to match against. That left every
  // comparator except `within` returning false for a span, so a match rule with a
  // range on either side reported EVERY item as failing: one authoring slip and
  // the rule blocked every cart in the catalog, while reading like a real finding.
  // Reported as unknown instead, which is what an unanswerable comparison is.
  //
  // Asked of each side's OWN reduction rather than by re-reading the item: an
  // item can be on both sides of a rule, and the old test picked the consumer
  // operand for anything that was, so a span on the provider side of such an item
  // went unnoticed.
  const spanSide =
    rule.comparator !== "within" &&
    [...consumers, ...providers].some(
      (entry) => entry.side.span !== null && entry.side.values.length === 0,
    );
  if (spanSide) {
    return {
      ...withSides,
      status: "unknown",
      message: `"${rule.name}" compares values as sets, but something in the selection answers "${consumerLabel}" or "${providerLabel}" as a range. Use "must fall within" to compare a value against a span.`,
    };
  }

  const failing = consumers.filter(
    (entry) =>
      !providers.some((provider) =>
        matchSatisfied(entry.side, provider.side, rule),
      ),
  );

  if (failing.length === 0) {
    return {
      ...withSides,
      status: "pass",
      message: `Every item's "${consumerLabel}" is compatible with the available "${providerLabel}".`,
    };
  }

  // Labels resolved against the side's OWN vocabulary — a group column's options,
  // when that is where the values came from. Read off the attribute instead, a
  // group has no options and every value rendered as its raw stored string.
  const describeSide = (side: MatchSide): string =>
    side.values
      .map(
        (value) =>
          side.options.find((option) => option.value === value)?.label ?? value,
      )
      .join(", ");

  const offered = [
    ...new Set(providers.flatMap((entry) => entry.side.values)),
  ].map(
    (value) =>
      providers
        .flatMap((entry) => entry.side.options)
        .find((option) => option.value === value)?.label ?? value,
  );

  return {
    ...withSides,
    failingItems: failing.map((entry) => participant(entry.item)),
    status: violation(rule),
    message: `${failing.length} item(s) have a "${consumerLabel}" the available "${providerLabel}" (${offered.join(", ") || "none"}) cannot support: ${failing
      .map((entry) => `${entry.item.name} (${describeSide(entry.side)})`)
      .join(", ")}.`,
    corrections: [
      correction(
        "swap",
        `Swap either side: pick items whose "${consumerLabel}" is one of ${offered.join(", ") || "the supported values"}, or a device whose "${providerLabel}" covers what you have.`,
      ),
    ],
  };
};

// ---------------------------------------------------------------------------
// Ratio
// ---------------------------------------------------------------------------

const evaluateRatio = (
  rule: EngineRelationship,
  selection: EngineItem[],
  context: EngineContext,
): Finding => {
  const providerUnit = operandUnit(rule.provider, context);
  const base = emptyFinding(rule, providerUnit);
  const target = rule.ratioLimit;

  if (target === null || target <= 0) {
    return {
      ...base,
      status: "unknown",
      message: `"${rule.name}" has no target ratio set, so it cannot be checked.`,
    };
  }

  const consumerSide = collectSide(
    rule.consumer,
    rule.consumerWhen,
    selection,
    context,
    "max",
  );
  const providerSide = collectSide(
    rule.provider,
    rule.providerWhen,
    selection,
    context,
    "min",
  );
  const skipped = [...consumerSide.skipped, ...providerSide.skipped];

  // A ratio whose demand comes from an unanswered project input cannot run —
  // and must say so, so the UI can ask the buyer the question.
  const demandFromVariable =
    rule.consumer?.source === "variable"
      ? context.variables.get(rule.consumer.variableUuid)
      : null;
  if (
    rule.consumer?.source === "variable" &&
    demandFromVariable?.value === null
  ) {
    return {
      ...base,
      skipped,
      status: "unknown",
      message: `Tell us "${demandFromVariable.label}" and we can check "${rule.name}".`,
    };
  }

  const demand =
    rule.consumer?.source === "variable"
      ? Number(demandFromVariable?.value ?? 0)
      : round2(
          consumerSide.participants.reduce(
            (sum, consumer) => sum + consumer.totalValue,
            0,
          ),
        );
  const supply = round2(
    providerSide.participants.reduce(
      (sum, provider) => sum + provider.totalValue,
      0,
    ),
  );

  if (demand === 0) {
    return {
      ...base,
      skipped,
      status: "not_applicable",
      message: `Nothing in the selection creates demand for "${rule.name}".`,
    };
  }
  if (supply === 0) {
    return {
      ...base,
      demand,
      skipped,
      status: "not_applicable",
      message: `Nothing in the selection supplies "${operandLabel(rule.provider, context)}" — this check does not apply.`,
    };
  }

  const actual = round2(demand / supply);
  const withSides = {
    ...base,
    consumers: consumerSide.participants,
    providers: providerSide.participants,
    skipped,
    demand,
    capacity: supply,
    effectiveCapacity: target,
  };

  if (actual <= target) {
    return {
      ...withSides,
      status: "pass",
      message: `Contention is ${actual}:1, within the ${target}:1 target (${formatValue(demand, operandUnit(rule.consumer, context))} demand ÷ ${formatValue(supply, providerUnit)} supply).`,
    };
  }
  return {
    ...withSides,
    status: violation(rule),
    message: `Contention is ${actual}:1, above the ${target}:1 target (${formatValue(demand, operandUnit(rule.consumer, context))} demand ÷ ${formatValue(supply, providerUnit)} supply).`,
    corrections: [
      correction(
        "add_supply",
        `Raise supply to at least ${formatValue(round2(demand / target), providerUnit)}.`,
        suggestProviders(rule, round2(demand / target), context),
      ),
      correction("reduce_demand", "Reduce demand, or accept the contention."),
    ],
  };
};

// ---------------------------------------------------------------------------
// Conditional
// ---------------------------------------------------------------------------

const evaluateConditional = (
  rule: EngineRelationship,
  selection: EngineItem[],
  context: EngineContext,
): Finding => {
  const operand = rule.consumer;
  const meta = operandMeta(operand, context);
  const base = emptyFinding(rule, meta?.unit ?? null);

  if (!operand || operand.source !== "spec" || !meta) {
    return {
      ...base,
      status: "unknown",
      message: `"${rule.name}" measures an attribute that no longer exists.`,
    };
  }
  const lookup = rule.lookup;
  if (!lookup || lookup.rows.length === 0) {
    return {
      ...base,
      status: "unknown",
      message: `"${rule.name}" has no lookup table to read a limit from.`,
    };
  }

  const judged = selection.flatMap((item) => {
    if (
      !evaluatePredicate(rule.consumerWhen, item.values, context.attributes, {
        categoryChain: item.categoryChain,
      }).matched
    ) {
      return [];
    }
    // The item's own measured value against a limit read from the table — a
    // consumer, so a span is judged at the end that could exceed the limit.
    const value = asNumber(
      readValue(item.values, operand.specUuid),
      meta,
      "max",
    );
    if (value === null) {
      return [];
    }
    // Rows are tried in author order, so a specific row may sit above a
    // catch-all. An item matching no row is outside what the table describes,
    // which is a gap in the table rather than a failure by the item.
    const matched = lookup.rows.find(
      (candidate) =>
        evaluatePredicate(candidate.when, item.values, context.attributes, {
          categoryChain: item.categoryChain,
        }).matched,
    );
    if (!matched) {
      return [];
    }
    return [{ item, value, limit: matched.limit }];
  });

  if (judged.length === 0) {
    return {
      ...base,
      status: "not_applicable",
      message: `Nothing in the selection has a combination "${rule.name}" covers.`,
    };
  }

  const participant = (entry: (typeof judged)[number]): Participant => ({
    productUuid: entry.item.productUuid,
    name: entry.item.name,
    quantity: entry.item.quantity,
    unitValue: entry.value,
    totalValue: round2(entry.value * entry.item.quantity),
  });

  const failing = judged.filter(
    (entry) =>
      !compare(
        entry.value,
        round2((entry.limit * rule.headroomPercent) / 100),
        rule.comparator,
      ),
  );
  const tightest = Math.min(...judged.map((entry) => entry.limit));
  const withSides = {
    ...base,
    consumers: judged.map(participant),
    capacity: tightest,
    effectiveCapacity: round2((tightest * rule.headroomPercent) / 100),
    demand: Math.max(...judged.map((entry) => entry.value)),
  };

  if (failing.length === 0) {
    return {
      ...withSides,
      status: "pass",
      message: `Every item's "${meta.label}" is within the limit its own configuration allows (tightest ${formatValue(tightest, meta.unit)}).`,
    };
  }
  return {
    ...withSides,
    failingItems: failing.map(participant),
    status: violation(rule),
    message: `${failing.length} item(s) exceed the limit their configuration allows: ${failing
      .map(
        (entry) =>
          `${entry.item.name} (${formatValue(entry.value, meta.unit)} against a limit of ${formatValue(entry.limit, meta.unit)})`,
      )
      .join(", ")}.`,
    corrections: [
      correction(
        "reduce_demand",
        `Bring "${meta.label}" within ${formatValue(tightest, meta.unit)}, or change the configuration that sets the limit.`,
      ),
    ],
  };
};

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

const evaluatePresence = (
  rule: EngineRelationship,
  selection: EngineItem[],
  context: EngineContext,
): Finding => {
  const base = emptyFinding(rule, null);
  const spec = rule.presence;
  if (!spec) {
    return {
      ...base,
      status: "unknown",
      message: `"${rule.name}" has no trigger set.`,
    };
  }

  const triggered = selection.filter(
    (item) =>
      evaluatePredicate(spec.trigger, item.values, context.attributes, {
        categoryChain: item.categoryChain,
      }).matched,
  );
  if (triggered.length === 0) {
    return {
      ...base,
      status: "not_applicable",
      message: `Nothing in the selection triggers "${rule.name}".`,
    };
  }

  const triggerQuantity = triggered.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const participant = (item: EngineItem): Participant => ({
    productUuid: item.productUuid,
    name: item.name,
    quantity: item.quantity,
    unitValue: 0,
    totalValue: 0,
  });
  const withSides = { ...base, consumers: triggered.map(participant) };

  for (const requirement of spec.requires) {
    // ANY one alternative satisfies the requirement.
    let satisfied = false;
    let companionQuantity = 0;

    for (const alternative of requirement.satisfiedBy) {
      if (alternative.type === "variable_true") {
        const variable = context.variables.get(alternative.variableUuid);
        if (variable?.value === true) {
          satisfied = true;
          break;
        }
        continue;
      }
      const companions = selection.filter(
        (item) =>
          evaluatePredicate(
            alternative.predicate,
            item.values,
            context.attributes,
            { categoryChain: item.categoryChain },
          ).matched,
      );
      if (companions.length === 0) {
        continue;
      }
      companionQuantity += companions.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      satisfied = true;
    }

    if (!satisfied) {
      return {
        ...withSides,
        status: violation(rule),
        demand: triggerQuantity,
        message: `${requirement.description} — ${triggerQuantity} item(s) in the selection need it and nothing provides it.`,
        corrections: [
          correction(
            "add_supply",
            spec.suggestedFix ??
              `Add what "${requirement.description}" asks for.`,
          ),
        ],
      };
    }

    // Quantity pairing: N triggers demand N companions. This is what lets
    // "every door needs a reader" be checked in total, without modelling
    // per-door grouping.
    if (requirement.perTriggerQuantity > 0) {
      const needed = Math.ceil(
        triggerQuantity * requirement.perTriggerQuantity,
      );
      if (companionQuantity < needed) {
        return {
          ...withSides,
          status: violation(rule),
          demand: needed,
          capacity: companionQuantity,
          message: `${requirement.description} — ${triggerQuantity} item(s) need ${needed} in total, but the selection has ${companionQuantity}.`,
          corrections: [
            correction(
              "add_supply",
              `Add ${needed - companionQuantity} more to match the quantity.`,
            ),
          ],
        };
      }
    }
  }

  return {
    ...withSides,
    status: "pass",
    message: `Everything "${rule.name}" requires is in the selection.`,
  };
};

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

const inScope = (
  rule: EngineRelationship,
  region: string | undefined,
): boolean => {
  if (!rule.scope || rule.scope.regions.length === 0) {
    return true;
  }
  if (!region) {
    return true;
  }
  return rule.scope.regions.includes(region);
};

/**
 * A check that passed while some items could not be read did not really pass —
 * it passed on the items it could see. The caveat goes into the message itself
 * rather than only into a field, because the buyer reads the sentence.
 */
const noteSkipped = (finding: Finding): Finding => {
  if (finding.skipped.length === 0 || finding.status === "unknown") {
    return finding;
  }
  const names = finding.skipped.map((item) => item.name).join(", ");
  return {
    ...finding,
    message: `${finding.message} ${finding.skipped.length} item(s) could not be checked because data is missing: ${names}.`,
  };
};

// How a rule uses a project input, which is also what kind of answer to collect.
//
// `magnitude` is a number the rule totals or compares — "how many calls at
// once". `toggle` is a yes/no that can excuse a required companion — "recording
// is in the cloud", which makes an on-site recorder unnecessary. The USE decides
// the input, not the variable's declared type: a rule is the only thing that
// knows whether it needs a quantity or a permission.
export type VariableAsk = {
  variableUuid: string;
  kind: "magnitude" | "toggle";
};

/**
 * The project inputs a rule reads — pure, so the surfaces can ask for them.
 *
 * The engine already refuses to run a rule whose variable is unanswered, and
 * says so in the finding. But nothing was collecting the answer, so a ratio rule
 * reported "tell us X" to a buyer with no field to tell us in, and a presence
 * requirement excusable by a yes/no could never be excused. This is the list a
 * cart turns into questions.
 */
export const ruleVariables = (rule: EngineRelationship): VariableAsk[] => {
  const asks: VariableAsk[] = [];
  const add = (variableUuid: string | null, kind: VariableAsk["kind"]) => {
    if (!variableUuid) {
      return;
    }
    if (asks.some((ask) => ask.variableUuid === variableUuid)) {
      return;
    }
    asks.push({ variableUuid, kind });
  };

  add(operandVariableUuid(rule.consumer), "magnitude");
  add(operandVariableUuid(rule.provider), "magnitude");
  for (const requirement of rule.presence?.requires ?? []) {
    for (const alternative of requirement.satisfiedBy) {
      if (alternative.type === "variable_true") {
        add(alternative.variableUuid, "toggle");
      }
    }
  }
  return asks;
};

/** Evaluate one relationship against a selection — pure, no I/O. */
export const evaluateRelationship = (
  rule: EngineRelationship,
  selection: EngineItem[],
  context: EngineContext,
): Finding => {
  if (!inScope(rule, context.region)) {
    return {
      ...emptyFinding(rule, null),
      status: "not_applicable",
      message: `"${rule.name}" does not apply in this market.`,
    };
  }
  if (rule.family === "presence") {
    return evaluatePresence(rule, selection, context);
  }
  if (rule.family === "match") {
    return evaluateMatch(rule, selection, context);
  }
  if (rule.family === "ratio") {
    return noteSkipped(evaluateRatio(rule, selection, context));
  }
  if (rule.family === "conditional") {
    return evaluateConditional(rule, selection, context);
  }
  // budget and count share the capacity evaluator; the only difference is that
  // count's consumer operand is `item_count`.
  return noteSkipped(evaluateCapacity(rule, selection, context));
};

/**
 * Evaluate every relationship against a selection.
 *
 * Presence findings come first: "you forgot the recorder" is more actionable
 * than "the recorder you have is too small", and a buyer reads the list in
 * order.
 */
export const evaluateSelection = (
  rules: EngineRelationship[],
  selection: EngineItem[],
  context: EngineContext,
): DesignReport => {
  const ordered = [
    ...rules.filter((rule) => rule.family === "presence"),
    ...rules.filter((rule) => rule.family !== "presence"),
  ];
  const findings = ordered.map((rule) =>
    evaluateRelationship(rule, selection, context),
  );

  return {
    findings,
    blockers: findings.filter((finding) => finding.status === "block"),
    warnings: findings.filter((finding) => finding.status === "warn"),
    unknowns: findings.filter((finding) => finding.status === "unknown"),
    passed: findings.filter((finding) => finding.status === "pass").length,
    notApplicable: findings.filter(
      (finding) => finding.status === "not_applicable",
    ).length,
  };
};

/**
 * Clean passes, and the passes that could not read everything they matched.
 *
 * A rule reports `pass` when what it COULD read was satisfied — the items it had
 * to skip are carried on the finding, not subtracted from the verdict. That is
 * the right call for the evaluator, and the wrong thing to hand a buyer as one
 * number: a rule that approved three products while unable to read five is not
 * the same fact as a rule that approved all eight, and counting them together
 * makes the second indistinguishable from the first.
 *
 * Split here rather than inside the design check so it can be tested without a
 * database.
 */
export const splitPasses = (
  findings: Finding[],
): { clean: number; partial: Finding[] } => {
  const passes = findings.filter((finding) => finding.status === "pass");
  const partial = passes.filter((finding) => finding.skipped.length > 0);
  return { clean: passes.length - partial.length, partial };
};
