import { asc, eq, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type {
  MatchMode,
  RelationshipAllocation,
  RelationshipComparator,
  RelationshipFamily,
  RelationshipGate,
} from "../../../db/enum";
import { RELATIONSHIP_COMPARATOR_LABELS } from "../../../db/label";
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
import { groupRowAttributes, validatePredicate } from "./predicate";
import {
  evaluateRelationship,
  evaluateSelection,
  type EngineRelationship,
  type EngineVariable,
  type Finding,
} from "./relationship-engine";
import { Products } from "../../../db/schema/products";
import {
  diagnoseRules,
  type ProductFacts,
  type RuleReach,
} from "./rule-reachability";
import { referencedAttributeUuids } from "./specification-library";
import { groupSubField, unitFactor, type AttributeMeta } from "./spec-values";

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

  // Free text can never be a side of a rule, in ANY family — checked before the
  // family branches so it is one refusal rather than six.
  //
  // Without it the failure is quiet and family-shaped: budget/count would report
  // "has no magnitude", which reads as "mark it ordered" and sends the author to
  // add ranks to sentences; match would accept it outright and then compare two
  // notes for string equality, passing exactly the pairs whose authors happened to
  // phrase things the same way. Neither looks like a broken rule from the outside.
  for (const [field, operand] of [
    ["consumer", input.consumer],
    ["provider", input.provider],
  ] as const) {
    if (operand?.source !== "spec") {
      continue;
    }
    const meta = model.attributes.get(operand.specUuid);
    if (meta?.type === "text") {
      problems.push({
        field,
        message: `"${meta.label}" holds free text, so it cannot be a side of a rule — there is nothing in it to add up or compare. Record the fact as a number or a pick if a rule needs to read it.`,
      });
    }
  }

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
      if (!meta) {
        return;
      }
      // A GROUP holds rows, so it has no magnitude until the rule names which
      // column to total. Every one of these three cases reads as nothing at
      // runtime and reports the item as missing a value — a rule that never fires
      // looks exactly like a rule nothing violated, so all three are caught here
      // where an author can still fix them.
      if (meta.type === "group") {
        if (!operand.groupField) {
          problems.push({
            field,
            message: `"${meta.label}" holds rows, so a rule has to say which count to add up — how many ports, how many outlets. Pick one of its sub-fields.`,
          });
          return;
        }
        const subField = groupSubField(meta, operand.groupField);
        if (!subField) {
          problems.push({
            field,
            message: `"${meta.label}" no longer has the sub-field this rule adds up. Pick another one.`,
          });
          return;
        }
        if (subField.kind !== "number") {
          problems.push({
            field,
            message: `"${subField.label}" is a pick, not a count, so it cannot be added up. Choose a sub-field that holds a number.`,
          });
        }
        // The row filter, checked against this group's OWN columns. A filter
        // naming a column that no longer exists keeps no rows, and the side then
        // measures a confident zero rather than reporting anything — the one
        // failure in this feature that would look like a real answer.
        for (const problem of validatePredicate(
          operand.where ?? null,
          groupRowAttributes(meta),
        )) {
          problems.push({
            field,
            message: `Only some rows of "${meta.label}": ${problem.message}`,
          });
        }
        return;
      }
      if (operand.where) {
        problems.push({
          field,
          message: `"${meta.label}" does not hold rows, so there are no rows for a filter to narrow.`,
        });
      }
      if (meta.type !== "number" && !meta.ordered) {
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

      // A GROUP side, resolved to the column the rule actually compares.
      //
      // The match evaluator reads a group through its named column, so the
      // ordering — and the vocabulary the ranks live in — belong to the SUB-FIELD,
      // not to the attribute. A group's own `ordered` is always false, so without
      // this every ordered comparator on a port group would be refused with advice
      // to go and mark the group as a scale, which is not a thing a group can be.
      //
      // Each failure below is a rule that would have matched every consumer
      // against an empty set of provider values: no column named, a column that no
      // longer exists, or a count column, which has no picks to compare. All three
      // read as "nothing satisfies this" and, on a blocking rule, stop every cart.
      const columnOf = (
        operand: Operand,
        meta: AttributeMeta | undefined,
        field: string,
      ): { label: string; ordered: boolean } => {
        if (!meta) {
          return { label: "the attribute", ordered: false };
        }
        if (meta.type !== "group") {
          if (operand.source === "spec" && operand.groupField) {
            problems.push({
              field,
              message: `"${meta.label}" does not hold rows, so it has no columns for a rule to compare.`,
            });
          }
          return { label: meta.label, ordered: meta.ordered };
        }
        const key = operand.source === "spec" ? operand.groupField : undefined;
        if (!key) {
          problems.push({
            field,
            message: `"${meta.label}" holds rows, so a rule has to say which column to compare — the family, the speed. Pick one of its sub-fields.`,
          });
          return { label: meta.label, ordered: false };
        }
        const subField = groupSubField(meta, key);
        if (!subField) {
          problems.push({
            field,
            message: `"${meta.label}" no longer has the column this rule compares. Pick another one.`,
          });
          return { label: meta.label, ordered: false };
        }
        if (subField.kind !== "select") {
          problems.push({
            field,
            message: `"${subField.label}" is a count, not a pick, so there is nothing in it to match against. Choose a column that holds a list of values.`,
          });
          return { label: subField.label, ordered: false };
        }
        return {
          label: `${meta.label} · ${subField.label}`,
          ordered: subField.ordered,
        };
      };

      const consumerSide = columnOf(input.consumer, consumerMeta, "consumer");
      const providerSide = columnOf(input.provider, providerMeta, "provider");

      const ranked =
        input.comparator === "lte" ||
        input.comparator === "gte" ||
        input.comparator === "lt" ||
        input.comparator === "gt";
      if (ranked && !consumerSide.ordered && !providerSide.ordered) {
        problems.push({
          field: "comparator",
          message: `"${RELATIONSHIP_COMPARATOR_LABELS[input.comparator]}" only means something on an ordered scale. Mark ${consumerSide.label} as ordered in the library, or use "must be one of".`,
        });
      }

      // A side answered as a SPAN has no set of values to compare. Every
      // comparator except "must fall within" then reads it as nothing and the rule
      // reports every item as failing — one authoring slip blocking every cart in
      // the catalog while reading like a real finding. Caught here instead.
      //
      // Read from `definitions` rather than `attributes`: `AttributeMeta` leaves
      // `allowRange` out deliberately, because every READER judges a span by its
      // shape. This is an authoring question, and authoring is where the flag lives.
      const spanUuids = new Set(
        model.definitions
          .filter((definition) => definition.allowRange)
          .map((definition) => definition.uuid),
      );
      const spanSide = [consumerMeta, providerMeta].find(
        (meta) => meta && spanUuids.has(meta.uuid),
      );
      if (input.comparator !== "within" && spanSide) {
        problems.push({
          field: "comparator",
          message: `"${spanSide.label}" is answered as a range, and this comparator compares sets of values. Use "must fall within" — it is the one that reads both ends of a span.`,
        });
      }
      if (input.comparator === "within") {
        // Both sides need a magnitude. A plain list has no inside, so "within"
        // would silently answer no for every item. Judged on the resolved SIDE,
        // so an ordered column of a group counts as a magnitude and an unordered
        // one is named as the column rather than as the group holding it.
        const flat = [
          { meta: consumerMeta, side: consumerSide },
          { meta: providerMeta, side: providerSide },
        ].find(
          (entry) =>
            entry.meta && entry.meta.type !== "number" && !entry.side.ordered,
        );
        if (flat) {
          problems.push({
            field: "comparator",
            message: `"${flat.side.label}" has no magnitude, so nothing can fall within it. Use a number attribute, or mark its options as an ordered scale.`,
          });
        }
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
    const meta = model.attributes.get(operand.specUuid);
    if (!meta) {
      return null;
    }
    // The SUB-FIELD's unit when one is named. A group carries no unit of its own,
    // so falling back to the attribute's would compare a port count against watts
    // and find them both unitless — which `unitFactor` reads as compatible.
    if (operand.groupField) {
      return groupSubField(meta, operand.groupField)?.unit ?? null;
    }
    return meta.unit;
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
/**
 * A side filter, short enough to sit inside a one-line summary.
 *
 * Deliberately shallow: the value is what distinguishes one guard from another
 * ("family is SFP" against "family is QSFP"), so a simple equality is spelled out
 * in full and anything more complex is named rather than unfolded. A summary that
 * tried to render a whole predicate tree would stop being a summary.
 */
const describeSide = (
  predicate: Predicate | null,
  model: Awaited<ReturnType<typeof getCatalogModel>>,
): string => {
  if (!predicate) {
    return "";
  }
  if (predicate.op === "equals" || predicate.op === "not_equals") {
    const meta = model.attributes.get(predicate.attr);
    const label =
      meta?.options.find((option) => option.value === predicate.value)?.label ??
      String(predicate.value);
    const negated = predicate.op === "not_equals" ? " not" : "";
    return ` (where ${meta?.label ?? "a deleted attribute"} is${negated} ${label})`;
  }
  if (predicate.op === "exists") {
    const meta = model.attributes.get(predicate.attr);
    return ` (where ${meta?.label ?? "a deleted attribute"} is answered)`;
  }
  return " (on a filtered set)";
};

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
    // Names the comparator and both side filters. "must be compatible with" hid
    // the difference between a seat gate and a downshift notice, and hid the
    // family guard entirely — so the three rules the port model needs, which
    // differ ONLY by their guard, all read as the same sentence.
    return `${name(rule.consumer)}${describeSide(rule.consumerWhen, model)} ${RELATIONSHIP_COMPARATOR_LABELS[rule.comparator]} ${name(rule.provider)}${describeSide(rule.providerWhen, model)}.`;
  }
  if (rule.family === "ratio") {
    return `${name(rule.consumer)} ÷ ${name(rule.provider)} must stay within ${rule.ratioLimit}:1.`;
  }
  if (rule.family === "conditional") {
    return `${name(rule.consumer)} must stay within the limit its own configuration allows.`;
  }
  return `When the trigger is present, the selection must also contain ${(rule.presence?.requires ?? []).map((requirement) => requirement.description).join("; ") || "its companion"}.`;
};

// ---------------------------------------------------------------------------
// Reachability
// ---------------------------------------------------------------------------

/**
 * `JSON_KEYS` rather than the column, because the diagnosis needs to know WHICH
 * attributes a product answers and never what it answered. Pulling every stored
 * value to count keys would move the whole catalogue's spec data across the wire
 * to compute a handful of integers.
 *
 * The driver hands a JSON array back as either a parsed array or its text,
 * depending on how the column is read, so both are accepted rather than trusting
 * one and silently counting nothing.
 */
const toAttributeUuids = (keys: unknown): string[] => {
  if (Array.isArray(keys)) {
    return keys.filter((key): key is string => typeof key === "string");
  }
  if (typeof keys !== "string") {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(keys);
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
};

/**
 * Why each rule can or cannot fire.
 *
 * Three queries, whatever the size of the catalogue — the model (cached), the
 * rules, and one pass over products for their answered-attribute keys. Never one
 * query per rule: this is an admin screen, but it reads the same tables the cart
 * does and the connection ceiling is shared.
 */
export const getRuleReachability = async (): Promise<RuleReach[]> => {
  const [model, rows, productRows] = await Promise.all([
    getCatalogModel(),
    listRelationships(),
    db
      .select({
        categoryUuid: Products.categoryUuid,
        keys: sql<unknown>`JSON_KEYS(${Products.specValues})`,
      })
      .from(Products),
  ]);

  const products: ProductFacts[] = productRows.map((product) => ({
    categoryUuid: product.categoryUuid,
    attributeUuids: toAttributeUuids(product.keys),
  }));

  return diagnoseRules({
    rules: rows.map((row) => ({
      uuid: row.uuid,
      name: row.name,
      family: row.family,
      attributeUuids: referencedAttributeUuids(row),
      predicates: [
        row.consumerWhen ?? null,
        row.providerWhen ?? null,
        row.presence?.trigger ?? null,
        ...(row.lookup?.rows ?? []).map((lookupRow) => lookupRow.when),
      ],
      regions: row.scope?.regions ?? null,
    })),
    attributeLabels: new Map(
      model.definitions.map((definition) => [definition.uuid, definition.label]),
    ),
    assignments: model.assignments,
    chains: model.chains,
    products,
  });
};

// ---------------------------------------------------------------------------
// The trace
// ---------------------------------------------------------------------------

export type TracedRule = {
  finding: Finding;
  // The one-line reading of the rule, so a `not_applicable` row can be judged
  // without opening the authoring form to remember what the rule asks for.
  summary: string;
};

/**
 * Every rule's verdict on a selection, including the ones that said nothing.
 *
 * Deliberately NOT part of `checkDesign`. The buyer is shown what is wrong with
 * their basket; being told that fourteen rules found nothing to say about it
 * would be noise. But for whoever authors the rules that silence is the most
 * important output on the screen — `not_applicable` is where a rule that was
 * supposed to cover this basket quietly failed to, and `pass` is the only proof
 * that a rule ran at all.
 *
 * Same evaluator, same model, same ordering as the gate. It reads; it never
 * writes and it never gates.
 */
export const traceDesign = async (
  selection: SelectionLine[],
  variables: Record<string, number | boolean> = {},
): Promise<TracedRule[]> => {
  const lines = selection.filter((line) => line.quantity > 0);
  if (lines.length === 0) {
    return [];
  }

  const [model, items, catalog] = await Promise.all([
    getCatalogModel(),
    loadSelection(lines),
    loadSuggestionCatalog(),
  ]);
  if (items.length === 0) {
    return [];
  }

  const resolved = new Map<string, EngineVariable>(
    model.variables.map((variable) => [
      variable.uuid,
      variable.uuid in variables
        ? { ...variable, value: variables[variable.uuid] }
        : variable,
    ]),
  );

  const report = evaluateSelection(model.relationships, items, {
    attributes: model.attributes,
    variables: resolved,
    catalog,
  });

  const byUuid = new Map(
    model.relationships.map((rule) => [rule.uuid, rule] as const),
  );

  return report.findings.map((finding) => {
    const rule = byUuid.get(finding.relationshipUuid);
    return {
      finding,
      summary: rule ? summarizeRelationship(rule, model) : "",
    };
  });
};
