"use server";

import { db } from "@/db";
import {
  Categories,
  InsertCategories,
  SelectCategories,
} from "@/db/schema/categories";
import { generateUuid } from "utils";
import { alias } from "drizzle-orm/mysql-core";
import { asc, count, eq, getTableColumns } from "drizzle-orm";
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

const ParentCategories = alias(Categories, "parent_categories");

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
  } catch {
    throw new Error("Failed to fetch categories");
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
  } catch {
    throw new Error("Failed to fetch category");
  }
};

export const createCategory = async (
  _prevState: CategoryActionResult,
  fields: CategoryFields,
): Promise<CategoryActionResult> => {
  const uuid = generateUuid();
  try {
    const [{ total }] = await db.select({ total: count() }).from(Categories);
    await db.insert(Categories).values({ ...fields, uuid, order: total });
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
