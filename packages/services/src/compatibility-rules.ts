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
import { validateRuleShape, type OperandShape } from "utils";

export type { SelectCompatibilityRules };

export type CompatibilityRuleFields = Omit<
  InsertCompatibilityRules,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

// A rule enriched with the bound specs' labels/units. Both are null on a side
// a conditional rule leaves empty — its capacity is the lookup table.
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

type ListRow = {
  rule: SelectCompatibilityRules;
  consumerSpecLabel: string | null;
  consumerSpecUnit: string | null;
  providerSpecLabel: string | null;
  providerSpecUnit: string | null;
};

const toListItem = (row: ListRow): CompatibilityRuleListItem => ({
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

/**
 * Refuse a relation the engine could not act on. A Budget rule pointed at a
 * dropdown attribute reports not_applicable forever — no error, no gate, no
 * clue — so the shape is checked here rather than discovered in production.
 */
const assertShapeValid = async (
  fields: CompatibilityRuleFields,
): Promise<void> => {
  const uuids = [fields.consumerSpecUuid, fields.providerSpecUuid].filter(
    (uuid): uuid is string => Boolean(uuid),
  );
  const rows =
    uuids.length > 0
      ? await db
          .select({
            uuid: Specifications.uuid,
            label: Specifications.label,
            valueType: Specifications.valueType,
            unit: Specifications.unit,
            ordered: Specifications.ordered,
          })
          .from(Specifications)
          .where(inArray(Specifications.uuid, uuids))
      : [];

  const shapeOf = (uuid: string | null | undefined): OperandShape | undefined => {
    const row = uuid ? rows.find((entry) => entry.uuid === uuid) : undefined;
    return row
      ? {
          label: row.label,
          valueType: row.valueType,
          unit: row.unit,
          ordered: row.ordered,
        }
      : undefined;
  };

  const problems = validateRuleShape({
    kind: fields.kind,
    // The column is defaulted, so an insert may legitimately omit it.
    comparator: fields.comparator ?? "lte",
    consumer: shapeOf(fields.consumerSpecUuid),
    provider: shapeOf(fields.providerSpecUuid),
    lookup: fields.lookup,
  });

  if (problems.length > 0) {
    throw new Error(problems.join(" "));
  }
};

// Each side of a rule binds a specification. The capacity side is the only
// one a family may leave empty — a conditional rule reads its limit from its
// lookup table instead.
const assertOperandsValid = (fields: CompatibilityRuleFields): void => {
  if (!fields.consumerSpecUuid) {
    throw new Error("Pick the consumed specification.");
  }
  if (fields.kind !== "conditional" && !fields.providerSpecUuid) {
    throw new Error("Pick the capacity specification.");
  }
  if (fields.kind === "conditional" && fields.providerSpecUuid) {
    throw new Error(
      "A conditional rule reads its limit from the lookup table — leave the capacity side empty.",
    );
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
  await assertShapeValid(fields);
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
  await assertShapeValid(fields);
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

// A rule as the assignment card shows it: which side this attribute sits on,
// and what it is measured against.
export type SpecRelation = SelectCompatibilityRules & {
  otherSpecUuid: string | null;
  otherSpecLabel: string | null;
  otherSpecUnit: string | null;
  // "demand" = this attribute is the consumed side, "supply" = the capacity.
  side: "demand" | "supply";
};

/**
 * Every rule touching any of these specs, grouped by spec uuid. A rule that
 * binds two of them appears under both, once as demand and once as supply —
 * which is correct: it is the same rule seen from either attribute.
 */
export const getRelationsBySpec = async (
  specUuids: string[],
): Promise<Record<string, SpecRelation[]>> => {
  if (specUuids.length === 0) {
    return {};
  }
  try {
    const [rules, specs] = await Promise.all([
      db
        .select()
        .from(CompatibilityRules)
        .where(
          or(
            inArray(CompatibilityRules.consumerSpecUuid, specUuids),
            inArray(CompatibilityRules.providerSpecUuid, specUuids),
          ),
        ),
      db
        .select({
          uuid: Specifications.uuid,
          label: Specifications.label,
          unit: Specifications.unit,
        })
        .from(Specifications),
    ]);

    const specByUuid = new Map(specs.map((spec) => [spec.uuid, spec]));
    const wanted = new Set(specUuids);
    const grouped: Record<string, SpecRelation[]> = {};

    const push = (
      specUuid: string,
      rule: (typeof rules)[number],
      otherUuid: string | null,
      side: "demand" | "supply",
    ) => {
      const other = otherUuid ? specByUuid.get(otherUuid) : undefined;
      const list = grouped[specUuid] ?? [];
      list.push({
        ...rule,
        otherSpecUuid: otherUuid,
        otherSpecLabel: other?.label ?? null,
        otherSpecUnit: other?.unit ?? null,
        side,
      });
      grouped[specUuid] = list;
    };

    for (const rule of rules) {
      if (rule.consumerSpecUuid && wanted.has(rule.consumerSpecUuid)) {
        push(rule.consumerSpecUuid, rule, rule.providerSpecUuid, "demand");
      }
      if (rule.providerSpecUuid && wanted.has(rule.providerSpecUuid)) {
        push(rule.providerSpecUuid, rule, rule.consumerSpecUuid, "supply");
      }
    }
    return grouped;
  } catch (error) {
    console.error("getRelationsBySpec failed:", error);
    throw new Error("Failed to fetch relations", { cause: error });
  }
};
