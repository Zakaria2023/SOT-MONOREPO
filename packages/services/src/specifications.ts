import { randomUUID } from "node:crypto";
import { asc, count, eq, inArray, like, or } from "drizzle-orm";
import { db } from "../../../db";
import { specificationDomains } from "../../../db/enum";
import { Categories } from "../../../db/schema/categories";
import {
  InsertSpecifications,
  SelectSpecifications,
  Specifications,
} from "../../../db/schema/specifications";
import {
  SelectSpecificationCategories,
  SpecificationCategories,
} from "../../../db/schema/specification-categories";
import {
  SelectSpecificationGroups,
  SpecificationGroups,
} from "../../../db/schema/specification-groups";
import { SpecField } from "../../../db/types";
import { getCategoryAssignments } from "./specification-assignments";

export type { SelectSpecifications };

export type SpecificationFields = Omit<
  InsertSpecifications,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

// A specification enriched with the categories it's directly assigned to.
export type SpecificationWithCategories = SelectSpecifications & {
  groupName: SelectSpecificationGroups["name"] | null;
  categoryUuids: string[];
  categoryNames: string[];
};

// A resolved attribute for display: its label and unit, for a product's chosen
// spec keys. Returned in the given key order; keys with no matching attribute
// (deleted/renamed) fall back to the key as the label.
export type ResolvedSpecification = {
  key: string;
  label: string;
  unit: SelectSpecifications["unit"];
  // The library group it belongs to, so the storefront can section the spec
  // table the same way the library is organised. Null for ungrouped.
  groupName: SelectSpecificationGroups["name"] | null;
};

export const getSpecificationsForKeys = async (
  keys: string[],
): Promise<ResolvedSpecification[]> => {
  if (keys.length === 0) {
    return [];
  }
  const rows = await db
    .select({
      key: Specifications.key,
      label: Specifications.label,
      unit: Specifications.unit,
      groupName: SpecificationGroups.name,
    })
    .from(Specifications)
    .leftJoin(
      SpecificationGroups,
      eq(Specifications.groupUuid, SpecificationGroups.uuid),
    )
    .where(inArray(Specifications.key, keys));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return keys.map(
    (key) => byKey.get(key) ?? { key, label: key, unit: null, groupName: null },
  );
};

/** All specifications, each with the categories it's directly assigned to. */
export const getSpecifications = async (): Promise<
  SpecificationWithCategories[]
> => {
  try {
    const specRows = await db
      .select({
        spec: Specifications,
        groupName: SpecificationGroups.name,
      })
      .from(Specifications)
      .leftJoin(
        SpecificationGroups,
        eq(Specifications.groupUuid, SpecificationGroups.uuid),
      )
      .orderBy(asc(Specifications.order));
    const specs = specRows.map((row) => ({
      ...row.spec,
      groupName: row.groupName,
    }));

    const links = await db
      .select({
        specificationUuid: SpecificationCategories.specificationUuid,
        categoryUuid: SpecificationCategories.categoryUuid,
        categoryName: Categories.name,
      })
      .from(SpecificationCategories)
      .leftJoin(
        Categories,
        eq(SpecificationCategories.categoryUuid, Categories.uuid),
      );

    return specs.map((spec) => {
      const own = links.filter((link) => link.specificationUuid === spec.uuid);
      return {
        ...spec,
        categoryUuids: own.map((link) => link.categoryUuid),
        categoryNames: own.map((link) => link.categoryName ?? ""),
      };
    });
  } catch (error) {
    console.error("getSpecifications failed:", error);
    throw new Error("Failed to fetch specifications", { cause: error });
  }
};

export type SpecificationListParams = {
  search?: string;
  limit: number;
  offset: number;
};

// A searched + paginated page of specifications, each enriched with the
// categories it's directly assigned to, plus the unfiltered total for that
// search. Returns raw rows + total; the caller assembles the page metadata.
export const getSpecificationsList = async (
  params: SpecificationListParams,
): Promise<{ items: SpecificationWithCategories[]; total: number }> => {
  const term = params.search?.trim();
  const where = term
    ? or(
        like(Specifications.label, `%${term}%`),
        like(Specifications.key, `%${term}%`),
      )
    : undefined;

  try {
    const [specRows, [totals]] = await Promise.all([
      db
        .select({
          spec: Specifications,
          groupName: SpecificationGroups.name,
        })
        .from(Specifications)
        .leftJoin(
          SpecificationGroups,
          eq(Specifications.groupUuid, SpecificationGroups.uuid),
        )
        .where(where)
        .orderBy(asc(Specifications.order))
        .limit(params.limit)
        .offset(params.offset),
      db.select({ total: count() }).from(Specifications).where(where),
    ]);

    const specs = specRows.map((row) => ({
      ...row.spec,
      groupName: row.groupName,
    }));

    // Only fetch category links for the specs on this page.
    const specUuids = specs.map((spec) => spec.uuid);
    const links =
      specUuids.length > 0
        ? await db
            .select({
              specificationUuid: SpecificationCategories.specificationUuid,
              categoryUuid: SpecificationCategories.categoryUuid,
              categoryName: Categories.name,
            })
            .from(SpecificationCategories)
            .leftJoin(
              Categories,
              eq(SpecificationCategories.categoryUuid, Categories.uuid),
            )
            .where(inArray(SpecificationCategories.specificationUuid, specUuids))
        : [];

    const items = specs.map((spec) => {
      const own = links.filter((link) => link.specificationUuid === spec.uuid);
      return {
        ...spec,
        categoryUuids: own.map((link) => link.categoryUuid),
        categoryNames: own.map((link) => link.categoryName ?? ""),
      };
    });

    return { items, total: Number(totals?.total ?? 0) };
  } catch (error) {
    console.error("getSpecificationsList failed:", error);
    throw new Error("Failed to fetch specifications", { cause: error });
  }
};

/** One specification with its assigned category uuids, for the edit form. */
export const getSpecification = async (
  uuid: string,
): Promise<SpecificationWithCategories | null> => {
  try {
    const [row] = await db
      .select({
        spec: Specifications,
        groupName: SpecificationGroups.name,
      })
      .from(Specifications)
      .leftJoin(
        SpecificationGroups,
        eq(Specifications.groupUuid, SpecificationGroups.uuid),
      )
      .where(eq(Specifications.uuid, uuid));
    if (!row) {
      return null;
    }
    const spec = { ...row.spec, groupName: row.groupName };

    const links = await db
      .select({
        categoryUuid: SpecificationCategories.categoryUuid,
        categoryName: Categories.name,
      })
      .from(SpecificationCategories)
      .leftJoin(
        Categories,
        eq(SpecificationCategories.categoryUuid, Categories.uuid),
      )
      .where(eq(SpecificationCategories.specificationUuid, uuid));

    return {
      ...spec,
      categoryUuids: links.map((link) => link.categoryUuid),
      categoryNames: links.map((link) => link.categoryName ?? ""),
    };
  } catch (error) {
    console.error("getSpecification failed:", error);
    throw new Error("Failed to fetch specification", { cause: error });
  }
};

// The transaction handle drizzle passes to a db.transaction callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The assignment switches, carried across a re-link so editing an attribute in
// the library never resets how a category uses it.
type PreservedSwitches = Pick<
  SelectSpecificationCategories,
  "isFilter" | "isRule" | "scope" | "showIf" | "audience" | "enabledValues" | "order"
>;

// Insert category links for a specification (no delete — caller decides).
// Runs on the given transaction so it's part of the caller's atomic write.
// `preserved` carries each category's existing switches; a category being
// linked for the first time gets the table defaults.
const insertSpecificationCategories = async (
  tx: Tx,
  specificationUuid: string,
  categoryUuids: string[],
  preserved: Map<string, PreservedSwitches> = new Map(),
): Promise<void> => {
  const unique = [...new Set(categoryUuids.filter((uuid) => uuid.length > 0))];
  if (unique.length > 0) {
    await tx.insert(SpecificationCategories).values(
      unique.map((categoryUuid) => ({
        uuid: randomUUID(),
        specificationUuid,
        categoryUuid,
        ...preserved.get(categoryUuid),
      })),
    );
  }
};

export const createSpecification = async (
  fields: SpecificationFields,
  categoryUuids: string[],
): Promise<string> => {
  const uuid = randomUUID();
  // Spec row + its category links in one atomic write.
  await db.transaction(async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(Specifications);
    await tx.insert(Specifications).values({ ...fields, uuid, order: total });
    await insertSpecificationCategories(tx, uuid, categoryUuids);
  });
  return uuid;
};

export const updateSpecification = async (
  uuid: string,
  fields: SpecificationFields,
  categoryUuids: string[],
): Promise<void> => {
  // Update the spec, clear its old links, and write the new ones as one atomic
  // write — a failure can't leave the spec updated but its links half-replaced.
  await db.transaction(async (tx) => {
    await tx.update(Specifications).set(fields).where(eq(Specifications.uuid, uuid));

    // Links carry the per-category assignment switches, so read them before
    // the delete and carry them over. Without this, editing an attribute's
    // label in the library would silently reset every category's filter/rule/
    // scope/show-if settings back to the defaults.
    const existing = await tx
      .select({
        categoryUuid: SpecificationCategories.categoryUuid,
        isFilter: SpecificationCategories.isFilter,
        isRule: SpecificationCategories.isRule,
        scope: SpecificationCategories.scope,
        showIf: SpecificationCategories.showIf,
        audience: SpecificationCategories.audience,
        enabledValues: SpecificationCategories.enabledValues,
        order: SpecificationCategories.order,
      })
      .from(SpecificationCategories)
      .where(eq(SpecificationCategories.specificationUuid, uuid));
    const preserved = new Map(
      existing.map(({ categoryUuid, ...switches }) => [categoryUuid, switches]),
    );

    await tx
      .delete(SpecificationCategories)
      .where(eq(SpecificationCategories.specificationUuid, uuid));
    await insertSpecificationCategories(tx, uuid, categoryUuids, preserved);
  });
};

export const deleteSpecification = async (uuid: string): Promise<void> => {
  await db.delete(Specifications).where(eq(Specifications.uuid, uuid));
};
