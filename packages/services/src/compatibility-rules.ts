import { randomUUID } from "node:crypto";
import {
  RULE_BLUEPRINTS,
  type RuleBlueprint,
  type RuleBlueprintOperand,
} from "./compatibility-rules-data";
import { count, desc, eq, inArray, like, or } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "../../../db";
import {
  CompatibilityRules,
  InsertCompatibilityRules,
  SelectCompatibilityRules,
} from "../../../db/schema/compatibility-rules";
import {
  ProjectVariables,
  SelectProjectVariables,
} from "../../../db/schema/project-variables";
import {
  SelectSpecifications,
  Specifications,
} from "../../../db/schema/specifications";

export type { SelectCompatibilityRules };

export type CompatibilityRuleFields = Omit<
  InsertCompatibilityRules,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

// A rule enriched with the label/unit of whatever each side binds — a spec or
// a project variable. Both are null on a side a conditional rule leaves empty.
export type CompatibilityRuleListItem = SelectCompatibilityRules & {
  consumerSpecLabel: SelectSpecifications["label"] | null;
  consumerSpecUnit: SelectSpecifications["unit"] | null;
  providerSpecLabel: SelectSpecifications["label"] | null;
  providerSpecUnit: SelectSpecifications["unit"] | null;
  consumerVariableLabel: SelectProjectVariables["label"] | null;
  consumerVariableUnit: SelectProjectVariables["unit"] | null;
  providerVariableLabel: SelectProjectVariables["label"] | null;
  providerVariableUnit: SelectProjectVariables["unit"] | null;
};

const consumerSpec = alias(Specifications, "ConsumerSpec");
const providerSpec = alias(Specifications, "ProviderSpec");
const consumerVariable = alias(ProjectVariables, "ConsumerVariable");
const providerVariable = alias(ProjectVariables, "ProviderVariable");

const listSelection = {
  rule: CompatibilityRules,
  consumerSpecLabel: consumerSpec.label,
  consumerSpecUnit: consumerSpec.unit,
  providerSpecLabel: providerSpec.label,
  providerSpecUnit: providerSpec.unit,
  consumerVariableLabel: consumerVariable.label,
  consumerVariableUnit: consumerVariable.unit,
  providerVariableLabel: providerVariable.label,
  providerVariableUnit: providerVariable.unit,
};

type ListRow = {
  rule: SelectCompatibilityRules;
  consumerSpecLabel: string | null;
  consumerSpecUnit: string | null;
  providerSpecLabel: string | null;
  providerSpecUnit: string | null;
  consumerVariableLabel: string | null;
  consumerVariableUnit: string | null;
  providerVariableLabel: string | null;
  providerVariableUnit: string | null;
};

const toListItem = (row: ListRow): CompatibilityRuleListItem => ({
  ...row.rule,
  consumerSpecLabel: row.consumerSpecLabel,
  consumerSpecUnit: row.consumerSpecUnit,
  providerSpecLabel: row.providerSpecLabel,
  providerSpecUnit: row.providerSpecUnit,
  consumerVariableLabel: row.consumerVariableLabel,
  consumerVariableUnit: row.consumerVariableUnit,
  providerVariableLabel: row.providerVariableLabel,
  providerVariableUnit: row.providerVariableUnit,
});

export type CompatibilityRulesListParams = {
  search?: string;
  limit: number;
  offset: number;
};

/**
 * A searched + paginated page of compatibility rules, each enriched with the
 * bound specs' labels/units (newest first), plus the unfiltered total for that
 * search. Search matches the rule name or either bound spec's label.
 */
export const getCompatibilityRules = async (
  params: CompatibilityRulesListParams,
): Promise<{ items: CompatibilityRuleListItem[]; total: number }> => {
  const term = params.search?.trim();
  const where = term
    ? or(
        like(CompatibilityRules.name, `%${term}%`),
        like(consumerSpec.label, `%${term}%`),
        like(providerSpec.label, `%${term}%`),
      )
    : undefined;

  try {
    const [rows, [totals]] = await Promise.all([
      db
        .select(listSelection)
        .from(CompatibilityRules)
        .leftJoin(
          consumerSpec,
          eq(CompatibilityRules.consumerSpecUuid, consumerSpec.uuid),
        )
        .leftJoin(
          providerSpec,
          eq(CompatibilityRules.providerSpecUuid, providerSpec.uuid),
        )
        .leftJoin(
          consumerVariable,
          eq(CompatibilityRules.consumerVariableUuid, consumerVariable.uuid),
        )
        .leftJoin(
          providerVariable,
          eq(CompatibilityRules.providerVariableUuid, providerVariable.uuid),
        )
        .where(where)
        .orderBy(desc(CompatibilityRules.createdAt))
        .limit(params.limit)
        .offset(params.offset),
      db
        .select({ total: count() })
        .from(CompatibilityRules)
        .leftJoin(
          consumerSpec,
          eq(CompatibilityRules.consumerSpecUuid, consumerSpec.uuid),
        )
        .leftJoin(
          providerSpec,
          eq(CompatibilityRules.providerSpecUuid, providerSpec.uuid),
        )
        .leftJoin(
          consumerVariable,
          eq(CompatibilityRules.consumerVariableUuid, consumerVariable.uuid),
        )
        .leftJoin(
          providerVariable,
          eq(CompatibilityRules.providerVariableUuid, providerVariable.uuid),
        )
        .where(where),
    ]);

    return { items: rows.map(toListItem), total: Number(totals?.total ?? 0) };
  } catch (error) {
    console.error("getCompatibilityRules failed:", error);
    throw new Error("Failed to fetch compatibility rules", { cause: error });
  }
};

export const getCompatibilityRule = async (
  uuid: string,
): Promise<CompatibilityRuleListItem | null> => {
  try {
    const [row] = await db
      .select(listSelection)
      .from(CompatibilityRules)
      .leftJoin(
        consumerSpec,
        eq(CompatibilityRules.consumerSpecUuid, consumerSpec.uuid),
      )
      .leftJoin(
        providerSpec,
        eq(CompatibilityRules.providerSpecUuid, providerSpec.uuid),
      )
      .leftJoin(
        consumerVariable,
        eq(CompatibilityRules.consumerVariableUuid, consumerVariable.uuid),
      )
      .leftJoin(
        providerVariable,
        eq(CompatibilityRules.providerVariableUuid, providerVariable.uuid),
      )
      .where(eq(CompatibilityRules.uuid, uuid));

    return row ? toListItem(row) : null;
  } catch (error) {
    console.error("getCompatibilityRule failed:", error);
    throw new Error("Failed to fetch compatibility rule", { cause: error });
  }
};

// Sum-budget and per-item rules compare consumer values directly against
// provider values, so both specs must be measured in the same unit. Count
// rules are exempt: they compare a quantity count against a count-like
// capacity (e.g. devices vs ports) — the consumer spec only marks
// participation there.
// Per-provider distribution only makes sense for "must fit within" on the
// aggregating kinds — per-item rules already judge units individually.
const assertAllocationValid = (fields: CompatibilityRuleFields): void => {
  if (fields.allocation !== "per_provider") {
    return;
  }
  if (fields.kind === "per_item_threshold" || fields.kind === "conditional") {
    throw new Error(
      "Per-device capacity applies to sum and count rules — per-item and conditional rules already check each unit individually.",
    );
  }
  if (fields.comparator !== "lte") {
    throw new Error(
      'Per-device capacity requires the "must fit within (≤)" comparison.',
    );
  }
};

const assertUnitsMatch = async (
  fields: CompatibilityRuleFields,
): Promise<void> => {
  // Count compares a quantity vs a count-like capacity; ratio divides two
  // (possibly different-unit) sums; spec_match compares select specs (no unit).
  // conditional compares an item against a looked-up limit in the item's own
  // unit — there is no second spec to agree with.
  if (
    fields.kind === "count_limit" ||
    fields.kind === "ratio" ||
    fields.kind === "spec_match" ||
    fields.kind === "conditional"
  ) {
    return;
  }

  const specUuids = [fields.consumerSpecUuid, fields.providerSpecUuid].filter(
    (uuid): uuid is string => Boolean(uuid),
  );

  const specRows =
    specUuids.length > 0
      ? await db
          .select({ uuid: Specifications.uuid, unit: Specifications.unit })
          .from(Specifications)
          .where(inArray(Specifications.uuid, specUuids))
      : [];

  // A variable operand carries its own unit and must agree with the spec on
  // the other side just as two specs must — expected concurrent calls (calls)
  // against a PBX's max concurrent calls (calls).
  const variableUuids = [
    fields.consumerVariableUuid,
    fields.providerVariableUuid,
  ].filter((uuid): uuid is string => Boolean(uuid));

  const variableRows =
    variableUuids.length > 0
      ? await db
          .select({ uuid: ProjectVariables.uuid, unit: ProjectVariables.unit })
          .from(ProjectVariables)
          .where(inArray(ProjectVariables.uuid, variableUuids))
      : [];

  const unitOf = (
    specUuid: string | null | undefined,
    variableUuid: string | null | undefined,
  ): string | null | undefined =>
    specUuid
      ? specRows.find((row) => row.uuid === specUuid)?.unit
      : variableRows.find((row) => row.uuid === variableUuid)?.unit;

  const consumerUnit = unitOf(
    fields.consumerSpecUuid,
    fields.consumerVariableUuid,
  );
  const providerUnit = unitOf(
    fields.providerSpecUuid,
    fields.providerVariableUuid,
  );

  if (consumerUnit !== providerUnit) {
    throw new Error(
      `Both sides must use the same unit for this rule type — got "${consumerUnit ?? "no unit"}" vs "${providerUnit ?? "no unit"}". Comparing different units is only valid for count rules.`,
    );
  }
};

// Each side of a rule is exactly one operand. Two would be ambiguous, none
// leaves the evaluator nothing to read — except on a conditional rule, whose
// capacity is its lookup table rather than anything on the provider side.
const assertOperandsValid = (fields: CompatibilityRuleFields): void => {
  const sides = [
    {
      name: "consumed",
      spec: fields.consumerSpecUuid,
      variable: fields.consumerVariableUuid,
      required: true,
    },
    {
      name: "capacity",
      spec: fields.providerSpecUuid,
      variable: fields.providerVariableUuid,
      required: fields.kind !== "conditional",
    },
  ];

  for (const side of sides) {
    const count = [side.spec, side.variable].filter(Boolean).length;
    if (count > 1) {
      throw new Error(
        `The ${side.name} side must be either a specification or a project variable, not both.`,
      );
    }
    if (count === 0 && side.required) {
      throw new Error(
        `Pick a specification or a project variable for the ${side.name} side.`,
      );
    }
  }

  if (fields.kind !== "conditional") {
    if (fields.lookup) {
      throw new Error(
        "A lookup table only applies to a conditional rule — clear it or change the rule type.",
      );
    }
    return;
  }

  if (!fields.lookup || fields.lookup.rows.length === 0) {
    throw new Error(
      "A conditional rule needs at least one lookup row — that table is where its limit comes from.",
    );
  }
  const missing = fields.lookup.rows.find(
    (row) => Object.keys(row.when).length === 0,
  );
  if (missing) {
    throw new Error(
      "Every lookup row must say which attribute values it applies to.",
    );
  }
};

export const createCompatibilityRule = async (
  fields: CompatibilityRuleFields,
): Promise<string> => {
  assertOperandsValid(fields);
  assertAllocationValid(fields);
  await assertUnitsMatch(fields);
  const uuid = randomUUID();
  await db.insert(CompatibilityRules).values({ ...fields, uuid });
  return uuid;
};

export const updateCompatibilityRule = async (
  uuid: string,
  fields: CompatibilityRuleFields,
): Promise<void> => {
  assertOperandsValid(fields);
  assertAllocationValid(fields);
  await assertUnitsMatch(fields);
  await db
    .update(CompatibilityRules)
    .set(fields)
    .where(eq(CompatibilityRules.uuid, uuid));
};

export const deleteCompatibilityRule = async (uuid: string): Promise<void> => {
  await db
    .delete(CompatibilityRules)
    .where(eq(CompatibilityRules.uuid, uuid));
};

// ---------------------------------------------------------------------------
// Blueprints — the researched rules, bound to the live library on demand.
// ---------------------------------------------------------------------------

export type RuleBlueprintStatus = RuleBlueprint & {
  // Attribute/variable keys the blueprint needs that don't exist yet. Empty
  // means it can be installed as-is.
  missing: string[];
  // True once a rule of this name exists, so it isn't offered twice.
  installed: boolean;
};

const operandKey = (operand: RuleBlueprintOperand): string | null =>
  operand.type === "lookup" ? null : operand.key;

/**
 * Every researched rule with what it still needs. A blueprint binds to
 * attributes by KEY, and the library is admin-built, so most will list missing
 * pieces until those attributes exist — which is the point: it tells an admin
 * exactly what to create rather than failing silently at insert time.
 */
export const getRuleBlueprints = async (): Promise<RuleBlueprintStatus[]> => {
  const [specs, variables, existing] = await Promise.all([
    db.select({ key: Specifications.key }).from(Specifications),
    db.select({ key: ProjectVariables.key }).from(ProjectVariables),
    db.select({ name: CompatibilityRules.name }).from(CompatibilityRules),
  ]);

  const specKeys = new Set(specs.map((row) => row.key));
  const variableKeys = new Set(variables.map((row) => row.key));
  const installedNames = new Set(existing.map((row) => row.name));

  return RULE_BLUEPRINTS.map((blueprint) => {
    const missing: string[] = [];
    for (const operand of [blueprint.consumer, blueprint.provider]) {
      const key = operandKey(operand);
      if (!key) {
        continue;
      }
      const known =
        operand.type === "variable" ? variableKeys.has(key) : specKeys.has(key);
      if (!known) {
        missing.push(key);
      }
    }
    // A conditional rule also reads the keys its table is keyed by.
    for (const input of blueprint.lookup?.inputs ?? []) {
      if (!specKeys.has(input)) {
        missing.push(input);
      }
    }
    return {
      ...blueprint,
      missing: [...new Set(missing)],
      installed: installedNames.has(blueprint.name),
    };
  });
};

/**
 * Create a real rule row from a blueprint, binding its keys to the library.
 * Refuses rather than half-installs when something it needs is absent.
 */
export const installRuleBlueprint = async (id: string): Promise<string> => {
  const blueprint = RULE_BLUEPRINTS.find((entry) => entry.id === id);
  if (!blueprint) {
    throw new Error(`Unknown rule blueprint "${id}".`);
  }

  const [specs, variables] = await Promise.all([
    db
      .select({ uuid: Specifications.uuid, key: Specifications.key })
      .from(Specifications),
    db
      .select({ uuid: ProjectVariables.uuid, key: ProjectVariables.key })
      .from(ProjectVariables),
  ]);
  const specByKey = new Map(specs.map((row) => [row.key, row.uuid]));
  const variableByKey = new Map(variables.map((row) => [row.key, row.uuid]));

  // Resolve one side to the pair of columns the row stores.
  const resolve = (operand: RuleBlueprintOperand, side: string) => {
    if (operand.type === "lookup") {
      return { specUuid: null, variableUuid: null };
    }
    if (operand.type === "variable") {
      const uuid = variableByKey.get(operand.key);
      if (!uuid) {
        throw new Error(
          `This rule needs a project variable "${operand.key}" for its ${side} side. Create it first.`,
        );
      }
      return { specUuid: null, variableUuid: uuid };
    }
    const uuid = specByKey.get(operand.key);
    if (!uuid) {
      throw new Error(
        `This rule needs a library attribute "${operand.key}" for its ${side} side. Create it first.`,
      );
    }
    return { specUuid: uuid, variableUuid: null };
  };

  const consumer = resolve(blueprint.consumer, "consumed");
  const provider = resolve(blueprint.provider, "capacity");

  for (const input of blueprint.lookup?.inputs ?? []) {
    if (!specByKey.has(input)) {
      throw new Error(
        `This rule's lookup table is keyed by "${input}", which isn't in the library yet. Create it first.`,
      );
    }
  }

  return createCompatibilityRule({
    name: blueprint.name,
    description: blueprint.description,
    kind: blueprint.kind,
    consumerSpecUuid: consumer.specUuid,
    providerSpecUuid: provider.specUuid,
    consumerVariableUuid: consumer.variableUuid,
    providerVariableUuid: provider.variableUuid,
    lookup: blueprint.lookup ?? null,
    comparator: blueprint.comparator,
    allocation: "pooled",
    headroomPercent: blueprint.headroomPercent ?? 100,
    ratioLimit: null,
    condition: null,
    severity: blueprint.severity,
    enabled: true,
  });
};
