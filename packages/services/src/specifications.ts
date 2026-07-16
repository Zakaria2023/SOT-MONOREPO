import { randomUUID } from "node:crypto";
import { asc, count, eq, inArray } from "drizzle-orm";
import { db } from "../../../db";
import { Categories } from "../../../db/schema/categories";
import {
  InsertSpecifications,
  SelectSpecifications,
  Specifications,
} from "../../../db/schema/specifications";
import { SpecificationCategories } from "../../../db/schema/specification-categories";
import {
  SelectSpecificationGroups,
  SpecificationGroups,
} from "../../../db/schema/specification-groups";
import { SpecField } from "../../../db/types";

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

// Insert category links for a specification (no delete — caller decides).
const insertSpecificationCategories = async (
  specificationUuid: string,
  categoryUuids: string[],
): Promise<void> => {
  const unique = [...new Set(categoryUuids.filter((uuid) => uuid.length > 0))];
  if (unique.length > 0) {
    await db.insert(SpecificationCategories).values(
      unique.map((categoryUuid) => ({
        uuid: randomUUID(),
        specificationUuid,
        categoryUuid,
      })),
    );
  }
};

export const createSpecification = async (
  fields: SpecificationFields,
  categoryUuids: string[],
): Promise<string> => {
  const uuid = randomUUID();
  const [{ total }] = await db
    .select({ total: count() })
    .from(Specifications);

  await db.insert(Specifications).values({ ...fields, uuid, order: total });
  // Fresh uuid — no existing links to clear, insert directly.
  await insertSpecificationCategories(uuid, categoryUuids);
  return uuid;
};

export const updateSpecification = async (
  uuid: string,
  fields: SpecificationFields,
  categoryUuids: string[],
): Promise<void> => {
  // The spec update and the old-links delete touch different tables — run
  // them in parallel, then write the new links.
  await Promise.all([
    db.update(Specifications).set(fields).where(eq(Specifications.uuid, uuid)),
    db
      .delete(SpecificationCategories)
      .where(eq(SpecificationCategories.specificationUuid, uuid)),
  ]);
  await insertSpecificationCategories(uuid, categoryUuids);
};

export const deleteSpecification = async (uuid: string): Promise<void> => {
  await db.delete(Specifications).where(eq(Specifications.uuid, uuid));
};

// The category itself plus every ancestor, walking up the parent chain. A
// specification assigned to any of these applies to the given category.
const getCategoryAndAncestors = async (
  categoryUuid: string,
): Promise<string[]> => {
  const all = await db
    .select({ uuid: Categories.uuid, parentUuid: Categories.parentUuid })
    .from(Categories);
  const parentOf = new Map(all.map((row) => [row.uuid, row.parentUuid]));

  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = categoryUuid;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = parentOf.get(current) ?? null;
  }
  return chain;
};

/**
 * The resolved spec template for a category: every specification assigned to it
 * or any of its ancestors, as SpecField[] (the shape products fill).
 */
export const getSpecificationsForCategory = async (
  categoryUuid: string,
): Promise<SpecField[]> => {
  try {
    const categoryUuids = await getCategoryAndAncestors(categoryUuid);
    if (categoryUuids.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        uuid: Specifications.uuid,
        key: Specifications.key,
        label: Specifications.label,
        valueType: Specifications.valueType,
        unit: Specifications.unit,
        options: Specifications.options,
        order: Specifications.order,
      })
      .from(Specifications)
      .innerJoin(
        SpecificationCategories,
        eq(SpecificationCategories.specificationUuid, Specifications.uuid),
      )
      .where(inArray(SpecificationCategories.categoryUuid, categoryUuids))
      .orderBy(asc(Specifications.order));

    // A spec linked to several ancestors shows up multiple times — dedupe.
    const seen = new Set<string>();
    const specs: SpecField[] = [];
    for (const row of rows) {
      if (seen.has(row.uuid)) {
        continue;
      }
      seen.add(row.uuid);
      specs.push({
        key: row.key,
        label: row.label,
        options: row.options ?? [],
        valueType: row.valueType,
        unit: row.unit,
      });
    }
    return specs;
  } catch (error) {
    console.error("getSpecificationsForCategory failed:", error);
    throw new Error("Failed to fetch specifications for category", {
      cause: error,
    });
  }
};
