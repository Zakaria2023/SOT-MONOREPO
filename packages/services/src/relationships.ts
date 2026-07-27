import { asc, eq } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type {
  MatchMode,
  RelationshipAllocation,
  RelationshipComparator,
  RelationshipFamily,
  RelationshipGate,
} from "../../../db/enum";
import {
  Relationships,
  type SelectRelationships,
} from "../../../db/schema/relationships";
import {
  predicateCategories,
  type LookupTable,
  type Operand,
  type Predicate,
  type PresenceSpec,
  type RelationshipScope,
} from "../../../db/types";
import { recordAudit } from "./catalog-audit";
import {
  getCatalogModel,
  invalidateCatalogModel,
  loadSelection,
  loadSuggestionCatalog,
  type SelectionLine,
} from "./catalog-model";
import { ValidationError } from "./errors";
import { validatePredicate } from "./predicate";
import {
  evaluateRelationship,
  type EngineRelationship,
  type EngineVariable,
  type Finding,
} from "./relationship-engine";
import { unitFactor } from "./spec-values";

// ---------------------------------------------------------------------------
// THE RELATIONSHIP SERVICE — authoring compatibility rules.
//
// A wrong rule blocks real sales across the whole catalog the instant it is
// saved, and the author has no way to see that from the form. So the lifecycle
// is draft → preview against a real cart → publish, and only published rules
// ever reach a buyer.
//
// Validation here is about the mistakes that are INVISIBLE at runtime: a budget
// whose two sides are in incompatible units silently never runs; a match rule
// with a numeric comparator on an unordered list silently never matches; a
// presence rule with no trigger silently never fires.
// ---------------------------------------------------------------------------

export type RelationshipInput = {
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

const toEngine = (row: SelectRelationships): EngineRelationship => ({
  uuid: row.uuid,
  name: row.name,
  description: row.description,
  family: row.family,
  gate: row.gate,
  comparator: row.comparator,
  matchMode: row.matchMode,
  headroomPercent: row.headroomPercent,
  ratioLimit: row.ratioLimit === null ? null : Number(row.ratioLimit),
  allocation: row.allocation,
  perItem: row.perItem,
  consumer: row.consumer ?? null,
  provider: row.provider ?? null,
  consumerWhen: row.consumerWhen ?? null,
  providerWhen: row.providerWhen ?? null,
  lookup: row.lookup ?? null,
  presence: row.presence ?? null,
  scope: row.scope ?? null,
});

export const listRelationships = async (): Promise<SelectRelationships[]> =>
  db.select().from(Relationships).orderBy(asc(Relationships.createdAt));

export const getRelationship = async (
  uuid: string,
): Promise<SelectRelationships | null> => {
  const [row] = await db
    .select()
    .from(Relationships)
    .where(eq(Relationships.uuid, uuid));
  return row ?? null;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type RelationshipProblem = {
  field: string;
  message: string;
};

/**
 * Everything wrong with a rule an author is about to save.
 *
 * Returned as a list rather than thrown one at a time, so the form can show all
 * of them at once instead of making the author play whack-a-mole.
 */
export const validateRelationship = async (
  input: RelationshipInput,
): Promise<RelationshipProblem[]> => {
  const model = await getCatalogModel();
  const problems: RelationshipProblem[] = [];

  if (input.name.trim() === "") {
    problems.push({ field: "name", message: "A rule needs a name." });
  }
  if (input.headroomPercent <= 0 || input.headroomPercent > 100) {
    problems.push({
      field: "headroomPercent",
      message: "Headroom must be between 1% and 100%.",
    });
  }

  // Every condition on the rule, wherever it lives. Collected first so the
  // category check below can run over all of them in one pass rather than being
  // repeated at each site that happens to hold a predicate.
  const conditions: [string, Predicate | null][] = [
    ["consumerWhen", input.consumerWhen],
    ["providerWhen", input.providerWhen],
    ...(input.family === "presence" && input.presence
      ? ([["presence.trigger", input.presence.trigger]] as [
          string,
          Predicate | null,
        ][])
      : []),
    ...(input.presence?.requires ?? []).flatMap((requirement, index) =>
      requirement.satisfiedBy.flatMap((alternative) =>
        alternative.type === "item_exists"
          ? ([[`presence.${index}`, alternative.predicate]] as [
              string,
              Predicate | null,
            ][])
          : [],
      ),
    ),
    ...(input.lookup?.rows ?? []).map(
      (row, index) =>
        [`lookup.${index}`, row.when] as [string, Predicate | null],
    ),
  ];

  for (const [field, predicate] of [
    ["consumerWhen", input.consumerWhen],
    ["providerWhen", input.providerWhen],
  ] as const) {
    for (const problem of validatePredicate(predicate, model.attributes)) {
      problems.push({ field, message: problem.message });
    }
  }

  // A product group pointing at a deleted category matches nothing, so the rule
  // silently stops applying. `validatePredicate` cannot catch this — it is given
  // the attribute index, not the tree — but this function has the whole model.
  for (const [field, predicate] of conditions) {
    for (const categoryUuid of predicateCategories(predicate)) {
      if (categoryUuid !== "" && !model.chains.has(categoryUuid)) {
        problems.push({
          field,
          message:
            "This rule names a product group that no longer exists, so it would never apply.",
        });
      }
    }
  }

  const operandExists = (operand: Operand | null): boolean => {
    if (!operand) {
      return false;
    }
    if (operand.source === "spec") {
      return model.attributes.has(operand.specUuid);
    }
    if (operand.source === "variable") {
      return model.variables.some(
        (variable) => variable.uuid === operand.variableUuid,
      );
    }
    return true;
  };

  const numericOperand = (operand: Operand | null, field: string): void => {
    if (!operand) {
      problems.push({ field, message: "This side has not been set." });
      return;
    }
    if (!operandExists(operand)) {
      problems.push({
        field,
        message: "This side refers to something that no longer exists.",
      });
      return;
    }
    if (operand.source === "spec") {
      const meta = model.attributes.get(operand.specUuid);
      if (meta && meta.type !== "number" && !meta.ordered) {
        problems.push({
          field,
          message: `"${meta.label}" has no magnitude, so it cannot be added up or compared. Use a number attribute, or mark its options as an ordered scale.`,
        });
      }
    }
  };

  if (input.family === "budget" || input.family === "count") {
    numericOperand(input.consumer, "consumer");
    numericOperand(input.provider, "provider");

    // The unit check at AUTHORING time. Catching this here is the difference
    // between an author fixing it in ten seconds and a rule that silently
    // refuses to run in production.
    if (input.consumer?.source !== "item_count") {
      const consumerUnit = operandUnitFor(input.consumer, model);
      const providerUnit = operandUnitFor(input.provider, model);
      const conversion = unitFactor(consumerUnit, providerUnit);
      if (!conversion.ok) {
        problems.push({
          field: "provider",
          message: `These two sides cannot be compared: ${conversion.reason}.`,
        });
      }
    }
  }

  if (input.family === "match") {
    if (
      input.consumer?.source !== "spec" ||
      input.provider?.source !== "spec"
    ) {
      problems.push({
        field: "consumer",
        message:
          "A match rule compares two attributes, so both sides must be attributes.",
      });
    } else {
      const consumerMeta = model.attributes.get(input.consumer.specUuid);
      const providerMeta = model.attributes.get(input.provider.specUuid);
      if (
        (input.comparator === "lte" || input.comparator === "gte") &&
        !consumerMeta?.ordered &&
        !providerMeta?.ordered
      ) {
        problems.push({
          field: "comparator",
          message: `"at most" and "at least" only mean something on an ordered scale. Mark ${consumerMeta?.label ?? "the attribute"} as ordered in the library, or use "must be one of".`,
        });
      }
    }
  }

  if (input.family === "ratio") {
    if (input.ratioLimit === null || input.ratioLimit <= 0) {
      problems.push({
        field: "ratioLimit",
        message: "A ratio rule needs a target ratio above zero.",
      });
    }
    numericOperand(input.consumer, "consumer");
    numericOperand(input.provider, "provider");
  }

  if (input.family === "conditional") {
    numericOperand(input.consumer, "consumer");
    if (!input.lookup || input.lookup.rows.length === 0) {
      problems.push({
        field: "lookup",
        message:
          "A conditional rule needs at least one row in its lookup table.",
      });
    } else {
      input.lookup.rows.forEach((row, index) => {
        for (const problem of validatePredicate(row.when, model.attributes)) {
          problems.push({
            field: `lookup.${index}`,
            message: `Row ${index + 1}: ${problem.message}`,
          });
        }
      });
    }
  }

  if (input.family === "presence") {
    if (!input.presence) {
      problems.push({
        field: "presence",
        message:
          "A presence rule needs a trigger and at least one requirement.",
      });
    } else {
      for (const problem of validatePredicate(
        input.presence.trigger,
        model.attributes,
      )) {
        problems.push({ field: "presence.trigger", message: problem.message });
      }
      if (input.presence.requires.length === 0) {
        problems.push({
          field: "presence",
          message: "Add at least one thing the trigger requires.",
        });
      }
      input.presence.requires.forEach((requirement, index) => {
        if (requirement.satisfiedBy.length === 0) {
          problems.push({
            field: `presence.${index}`,
            message: `Requirement ${index + 1} has no way to be satisfied, so it can never pass.`,
          });
        }
        for (const alternative of requirement.satisfiedBy) {
          if (alternative.type === "item_exists") {
            for (const problem of validatePredicate(
              alternative.predicate,
              model.attributes,
            )) {
              problems.push({
                field: `presence.${index}`,
                message: problem.message,
              });
            }
          }
        }
      });
    }
  }

  return problems;
};

const operandUnitFor = (
  operand: Operand | null,
  model: Awaited<ReturnType<typeof getCatalogModel>>,
): string | null => {
  if (!operand) {
    return null;
  }
  if (operand.source === "spec") {
    return model.attributes.get(operand.specUuid)?.unit ?? null;
  }
  if (operand.source === "variable") {
    return (
      model.variables.find((variable) => variable.uuid === operand.variableUuid)
        ?.unit ?? null
    );
  }
  return null;
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const toRow = (input: RelationshipInput) => ({
  name: input.name.trim(),
  description: input.description?.trim() || null,
  family: input.family,
  gate: input.gate,
  comparator: input.comparator,
  matchMode: input.matchMode,
  headroomPercent: input.headroomPercent,
  ratioLimit: input.ratioLimit === null ? null : String(input.ratioLimit),
  allocation: input.allocation,
  perItem: input.perItem,
  consumer: input.consumer,
  provider: input.provider,
  consumerWhen: input.consumerWhen,
  providerWhen: input.providerWhen,
  lookup: input.lookup,
  presence: input.presence,
  scope: input.scope,
});

/**
 * Create a rule. LIVE immediately.
 *
 * There used to be a draft state here, on the reasoning that nothing should
 * reach a buyer unreviewed. In practice the review was a button nobody had a
 * reason to press: the rule is already validated on save, and a rule sitting in
 * draft is a gate somebody believes is protecting them while it protects
 * nothing. "Try it" is how a rule gets reviewed now, and it works on a live rule
 * just as well as on a draft.
 */
export const createRelationship = async (
  input: RelationshipInput,
  actor?: { uuid: string; name: string },
): Promise<string> => {
  const problems = await validateRelationship(input);
  const first = problems[0];
  if (first) {
    throw new ValidationError(first.message);
  }

  const uuid = generateUuid();
  await db.insert(Relationships).values({
    uuid,
    status: "published",
    ...toRow(input),
  });

  await recordAudit({
    target: "relationship",
    action: "create",
    targetUuid: uuid,
    targetLabel: input.name,
    actor,
  });
  invalidateCatalogModel();
  return uuid;
};

export const updateRelationship = async (
  uuid: string,
  input: RelationshipInput,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  const problems = await validateRelationship(input);
  const first = problems[0];
  if (first) {
    throw new ValidationError(first.message);
  }

  const current = await getRelationship(uuid);
  if (!current) {
    throw new ValidationError("That rule no longer exists.");
  }

  await db
    .update(Relationships)
    .set(toRow(input))
    .where(eq(Relationships.uuid, uuid));

  await recordAudit({
    target: "relationship",
    action: "update",
    targetUuid: uuid,
    targetLabel: input.name,
    actor,
    changes: [
      { field: "family", from: current.family, to: input.family },
      { field: "gate", from: current.gate, to: input.gate },
      {
        field: "headroomPercent",
        from: current.headroomPercent,
        to: input.headroomPercent,
      },
    ].filter((change) => change.from !== change.to),
  });
  invalidateCatalogModel();
};

/** Hard delete, allowed only for a rule that was never published. */
export const deleteRelationship = async (
  uuid: string,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  const current = await getRelationship(uuid);
  if (!current) {
    return;
  }
  // Deleted outright, whatever state it is in. The reason a published rule used
  // to be undeletable was to keep the record of why past orders were validated
  // as they were — but that record does not live here. Every order snapshots the
  // findings it was judged against at the moment it was placed, so deleting the
  // rule now cannot rewrite what any order was told.
  await db.delete(Relationships).where(eq(Relationships.uuid, uuid));
  await recordAudit({
    target: "relationship",
    action: "delete",
    targetUuid: uuid,
    targetLabel: current.name,
    actor,
  });
  invalidateCatalogModel();
};

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export type RelationshipPreview = {
  finding: Finding;
  // Plain-language reading of what the rule will do, generated from the row so
  // it cannot drift from the stored data the way a hand-written note would.
  summary: string;
};

/**
 * Run a single rule — published or draft — against a real selection.
 *
 * This is what makes the draft state worth having: the author sees the finding
 * their rule would produce, in the words the buyer would read, before anyone is
 * blocked by it.
 */
export const previewRelationship = async (
  uuid: string,
  selection: SelectionLine[],
  variables: Record<string, number | boolean> = {},
): Promise<RelationshipPreview | null> => {
  const row = await getRelationship(uuid);
  if (!row) {
    return null;
  }

  const [model, items, catalog] = await Promise.all([
    getCatalogModel(),
    loadSelection(selection),
    loadSuggestionCatalog(),
  ]);

  const resolvedVariables = new Map<string, EngineVariable>(
    model.variables.map((variable) => [
      variable.uuid,
      variable.uuid in variables
        ? { ...variable, value: variables[variable.uuid] }
        : variable,
    ]),
  );

  const rule = toEngine(row);
  return {
    finding: evaluateRelationship(rule, items, {
      attributes: model.attributes,
      variables: resolvedVariables,
      catalog,
    }),
    summary: summarizeRelationship(rule, model),
  };
};

/** A one-line reading of the rule, built from the row itself. */
export const summarizeRelationship = (
  rule: EngineRelationship,
  model: Awaited<ReturnType<typeof getCatalogModel>>,
): string => {
  const name = (operand: Operand | null): string => {
    if (!operand) {
      return "—";
    }
    if (operand.source === "spec") {
      return (
        model.attributes.get(operand.specUuid)?.label ?? "a deleted attribute"
      );
    }
    if (operand.source === "variable") {
      return (
        model.variables.find((entry) => entry.uuid === operand.variableUuid)
          ?.label ?? "a deleted input"
      );
    }
    if (operand.source === "item_count") {
      return "the number of matching items";
    }
    return `${operand.value}`;
  };

  const headroom =
    rule.headroomPercent === 100
      ? ""
      : ` (using ${rule.headroomPercent}% of it)`;

  if (rule.family === "budget") {
    return rule.perItem
      ? `Each item's ${name(rule.consumer)} must fit one device's ${name(rule.provider)}${headroom}.`
      : `Total ${name(rule.consumer)} must fit ${name(rule.provider)}${headroom}, ${rule.allocation === "per_unit" ? "device by device" : "pooled across devices"}.`;
  }
  if (rule.family === "count") {
    // "Matching" is vague when the rule names a group, and a group is what the
    // Count form writes — so say which one, by the count of categories rather
    // than by a uuid nobody can read.
    const groups = predicateCategories(rule.consumerWhen);
    const counted =
      groups.length > 0 ? "items in the chosen group" : "matching items";
    return `The number of ${counted} must fit ${name(rule.provider)}${headroom}.`;
  }
  if (rule.family === "match") {
    return `${name(rule.consumer)} must be compatible with ${name(rule.provider)}.`;
  }
  if (rule.family === "ratio") {
    return `${name(rule.consumer)} ÷ ${name(rule.provider)} must stay within ${rule.ratioLimit}:1.`;
  }
  if (rule.family === "conditional") {
    return `${name(rule.consumer)} must stay within the limit its own configuration allows.`;
  }
  return `When the trigger is present, the selection must also contain ${(rule.presence?.requires ?? []).map((requirement) => requirement.description).join("; ") || "its companion"}.`;
};
