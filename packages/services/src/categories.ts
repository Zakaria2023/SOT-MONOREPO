import {
  asc,
  count,
  eq,
  getTableColumns,
  isNull,
  like,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import {
  buildPaginatedResult,
  deriveCode,
  generateUuid,
  resolvePagination,
  resolveUniqueCode,
  type PaginatedResult,
} from "utils";
import { db } from "../../../db";
import {
  Categories,
  InsertCategories,
  SelectCategories,
} from "../../../db/schema/categories";
import { Products } from "../../../db/schema/products";

export type { SelectCategories };

export type CategoryListItem = SelectCategories & {
  parentName: SelectCategories["name"] | null;
  productCount: number;
};

export type CategoryFields = Omit<
  InsertCategories,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type CategoryListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

const ParentCategories = alias(Categories, "parent_categories");

// The row selection shared by every list query: the category columns, its
// parent's name, and how many products sit directly in it.
const categoryListSelection = {
  ...getTableColumns(Categories),
  parentName: ParentCategories.name,
  productCount: count(Products.id),
};

// Match a search term against the category name or its generated code.
const categorySearchFilter = (search?: string) => {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }
  return or(
    like(Categories.name, `%${term}%`),
    like(Categories.code, `%${term}%`),
  );
};

/** Every category with its parent name and product count, ordered by `order`. */
export const getCategories = async (): Promise<CategoryListItem[]> => {
  try {
    return await db
      .select(categoryListSelection)
      .from(Categories)
      .leftJoin(
        ParentCategories,
        eq(Categories.parentUuid, ParentCategories.uuid),
      )
      .leftJoin(Products, eq(Products.categoryUuid, Categories.uuid))
      .groupBy(Categories.id)
      .orderBy(asc(Categories.order));
  } catch (error) {
    console.error("getCategories failed:", error);
    throw new Error("Failed to fetch categories", { cause: error });
  }
};

/** A searched + paginated page of categories for the admin list table. */
export const getCategoriesPage = async (
  params: CategoryListParams = {},
): Promise<PaginatedResult<CategoryListItem>> => {
  const { page, pageSize, offset } = resolvePagination(
    params.page,
    params.pageSize,
  );
  const where = categorySearchFilter(params.search);

  try {
    const [rows, [totals]] = await Promise.all([
      db
        .select(categoryListSelection)
        .from(Categories)
        .leftJoin(
          ParentCategories,
          eq(Categories.parentUuid, ParentCategories.uuid),
        )
        .leftJoin(Products, eq(Products.categoryUuid, Categories.uuid))
        .where(where)
        .groupBy(Categories.id)
        .orderBy(asc(Categories.order))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(Categories).where(where),
    ]);

    return buildPaginatedResult(rows, Number(totals?.total ?? 0), page, pageSize);
  } catch (error) {
    console.error("getCategoriesPage failed:", error);
    throw new Error("Failed to fetch categories", { cause: error });
  }
};

/**
 * Every direct child of a parent (or the top-level categories when parentUuid
 * is null), ordered by their per-parent `order`. Unpaginated — feeds the
 * drag-and-drop reorder view, which shows all siblings at once.
 */
export const getCategoryChildren = async (
  parentUuid: string | null,
): Promise<CategoryListItem[]> => {
  try {
    return await db
      .select(categoryListSelection)
      .from(Categories)
      .leftJoin(
        ParentCategories,
        eq(Categories.parentUuid, ParentCategories.uuid),
      )
      .leftJoin(Products, eq(Products.categoryUuid, Categories.uuid))
      .where(
        parentUuid
          ? eq(Categories.parentUuid, parentUuid)
          : isNull(Categories.parentUuid),
      )
      .groupBy(Categories.id)
      .orderBy(asc(Categories.order));
  } catch (error) {
    console.error("getCategoryChildren failed:", error);
    throw new Error("Failed to fetch category children", { cause: error });
  }
};

export const getCategory = async (
  uuid: string,
): Promise<SelectCategories | null> => {
  try {
    const [category] = await db
      .select()
      .from(Categories)
      .where(eq(Categories.uuid, uuid));

    return category ?? null;
  } catch (error) {
    console.error("getCategory failed:", error);
    throw new Error("Failed to fetch category", { cause: error });
  }
};

/** Create a category with a system-generated unique code. Returns its uuid. */
export const createCategory = async (
  fields: CategoryFields,
): Promise<string> => {
  const uuid = generateUuid();
  const existing = await db.select({ code: Categories.code }).from(Categories);
  const taken = new Set(
    existing
      .map((row) => row.code)
      .filter((code): code is string => Boolean(code)),
  );
  const code = resolveUniqueCode(deriveCode(fields.name), taken);
  await db
    .insert(Categories)
    .values({ ...fields, uuid, order: existing.length, code });
  return uuid;
};

export const updateCategory = async (
  uuid: string,
  fields: CategoryFields,
): Promise<void> => {
  await db.update(Categories).set(fields).where(eq(Categories.uuid, uuid));
};

export const deleteCategory = async (uuid: string): Promise<void> => {
  await db.delete(Categories).where(eq(Categories.uuid, uuid));
};

/**
 * Persist a new sibling order: each category's `order` becomes its index in the
 * given list, scoped to the parent (0-based among its children). Atomic — a
 * mid-way failure rolls back instead of leaving a half-applied order.
 */
export const reorderCategories = async (
  orderedUuids: string[],
): Promise<void> => {
  if (orderedUuids.length === 0) {
    return;
  }
  await db.transaction(async (tx) => {
    for (let index = 0; index < orderedUuids.length; index++) {
      await tx
        .update(Categories)
        .set({ order: index })
        .where(eq(Categories.uuid, orderedUuids[index]));
    }
  });
};
