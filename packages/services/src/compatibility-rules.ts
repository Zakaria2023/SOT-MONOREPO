import { randomUUID } from "node:crypto";
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
