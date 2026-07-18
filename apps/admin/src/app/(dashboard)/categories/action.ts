"use server";

import { db } from "@/db";
import {
  Categories,
  InsertCategories,
  SelectCategories,
} from "@/db/schema/categories";
import type { PaginatedResult } from "utils";
import {
  buildPaginatedResult,
  deriveCode,
  generateUuid,
  resolvePagination,
  resolveUniqueCode,
} from "utils";
import { alias } from "drizzle-orm/mysql-core";
import {
  asc,
  count,
  eq,
  getTableColumns,
  isNull,
  like,
  or,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CategoryFields = Omit<
  InsertCategories,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type CategoryActionResult = {
  categoryUuid?: string;
  error?: string;
  success?: boolean;
};

export type CategoryListItem = SelectCategories & {
  parentName: SelectCategories["name"] | null;
};

export type CategoryListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

const ParentCategories = alias(Categories, "parent_categories");

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

// Full, unpaginated list — used to populate the parent-category dropdowns on
// the category/product/specification forms, which need every category.
export const getCategories = async (): Promise<CategoryListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Categories),
        parentName: ParentCategories.name,
      })
      .from(Categories)
      .leftJoin(ParentCategories, eq(Categories.parentUuid, ParentCategories.uuid))
      .orderBy(asc(Categories.order));
  } catch (error) {
    console.error("getCategories failed:", error);
    throw new Error("Failed to fetch categories", { cause: error });
  }
};

// Searched + paginated page of categories for the list table. The frontend
// drives `search`/`page` through URL search params.
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
        .select({
          ...getTableColumns(Categories),
          parentName: ParentCategories.name,
        })
        .from(Categories)
        .leftJoin(
          ParentCategories,
          eq(Categories.parentUuid, ParentCategories.uuid),
        )
        .where(where)
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

// Every direct child of a parent (or the top-level categories when parentUuid
// is null), ordered by their per-parent `order`. Unpaginated — this feeds the
// drag-and-drop reorder view, which shows all siblings at once.
export const getCategoryChildren = async (
  parentUuid: string | null,
): Promise<CategoryListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Categories),
        parentName: ParentCategories.name,
      })
      .from(Categories)
      .leftJoin(
        ParentCategories,
        eq(Categories.parentUuid, ParentCategories.uuid),
      )
      .where(
        parentUuid
          ? eq(Categories.parentUuid, parentUuid)
          : isNull(Categories.parentUuid),
      )
      .orderBy(asc(Categories.order));
  } catch (error) {
    console.error("getCategoryChildren failed:", error);
    throw new Error("Failed to fetch category children", { cause: error });
  }
};

// Persist a new sibling order: each category's `order` becomes its index in the
// given list. The order is scoped to the parent (0-based among its children) —
// it does not touch categories under any other parent.
export const reorderCategories = async (
  orderedUuids: string[],
): Promise<{ error?: string }> => {
  try {
    await Promise.all(
      orderedUuids.map((uuid, index) =>
        db.update(Categories).set({ order: index }).where(eq(Categories.uuid, uuid)),
      ),
    );
    revalidatePath("/categories");
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to reorder categories",
    };
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

export const createCategory = async (
  _prevState: CategoryActionResult,
  fields: CategoryFields,
): Promise<CategoryActionResult> => {
  const uuid = generateUuid();
  try {
    const existing = await db.select({ code: Categories.code }).from(Categories);
    const taken = new Set(
      existing.map((row) => row.code).filter((code): code is string =>
        Boolean(code),
      ),
    );
    const code = resolveUniqueCode(deriveCode(fields.name), taken);
    await db
      .insert(Categories)
      .values({ ...fields, uuid, order: existing.length, code });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create category",
    };
  }

  revalidatePath("/categories");
  redirect("/categories");
};

export const updateCategory = async (
  uuid: string,
  _prevState: CategoryActionResult,
  fields: CategoryFields,
): Promise<CategoryActionResult> => {
  try {
    await db.update(Categories).set(fields).where(eq(Categories.uuid, uuid));
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update category",
    };
  }

  revalidatePath("/categories");
  redirect("/categories");
};

export const deleteCategory = async (
  uuid: string,
): Promise<CategoryActionResult> => {
  try {
    await db.delete(Categories).where(eq(Categories.uuid, uuid));
    revalidatePath("/categories");
    return { success: true, categoryUuid: uuid };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete category",
    };
  }
};
