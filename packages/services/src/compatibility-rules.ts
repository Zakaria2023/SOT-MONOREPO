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
  SelectSpecifications,
  Specifications,
} from "../../../db/schema/specifications";

export type { SelectCompatibilityRules };

export type CompatibilityRuleFields = Omit<
  InsertCompatibilityRules,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

// A rule enriched with the labels/units of the two specs it binds.
export type CompatibilityRuleListItem = SelectCompatibilityRules & {
  consumerSpecLabel: SelectSpecifications["label"] | null;
  consumerSpecUnit: SelectSpecifications["unit"] | null;
  providerSpecLabel: SelectSpecifications["label"] | null;
  providerSpecUnit: SelectSpecifications["unit"] | null;
};

const consumerSpec = alias(Specifications, "ConsumerSpec");
const providerSpec = alias(Specifications, "ProviderSpec");

const listSelection = {
  rule: CompatibilityRules,
  consumerSpecLabel: consumerSpec.label,
  consumerSpecUnit: consumerSpec.unit,
  providerSpecLabel: providerSpec.label,
  providerSpecUnit: providerSpec.unit,
};

const toListItem = (row: {
  rule: SelectCompatibilityRules;
  consumerSpecLabel: string | null;
  consumerSpecUnit: string | null;
  providerSpecLabel: string | null;
  providerSpecUnit: string | null;
}): CompatibilityRuleListItem => ({
  ...row.rule,
  consumerSpecLabel: row.consumerSpecLabel,
  consumerSpecUnit: row.consumerSpecUnit,
  providerSpecLabel: row.providerSpecLabel,
  providerSpecUnit: row.providerSpecUnit,
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
  if (fields.kind === "per_item_threshold") {
    throw new Error(
      "Per-device capacity applies to sum and count rules — per-item rules already check each unit individually.",
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
  if (
    fields.kind === "count_limit" ||
    fields.kind === "ratio" ||
    fields.kind === "spec_match"
  ) {
    return;
  }

  const rows = await db
    .select({ uuid: Specifications.uuid, unit: Specifications.unit })
    .from(Specifications)
    .where(
      inArray(Specifications.uuid, [
        fields.consumerSpecUuid,
        fields.providerSpecUuid,
      ]),
    );

  const consumerUnit = rows.find(
    (row) => row.uuid === fields.consumerSpecUuid,
  )?.unit;
  const providerUnit = rows.find(
    (row) => row.uuid === fields.providerSpecUuid,
  )?.unit;

  if (consumerUnit !== providerUnit) {
    throw new Error(
      `Both specifications must use the same unit for this rule type — got "${consumerUnit ?? "no unit"}" vs "${providerUnit ?? "no unit"}". Comparing different units is only valid for count rules.`,
    );
  }
};

export const createCompatibilityRule = async (
  fields: CompatibilityRuleFields,
): Promise<string> => {
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
