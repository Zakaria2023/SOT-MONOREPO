"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCategory as createCategoryRecord,
  deleteCategory as deleteCategoryRecord,
  getCategories as getCategoriesList,
  getCategoriesPage as getCategoriesPageList,
  getCategory as getCategoryRecord,
  getCategoryChildren as getCategoryChildrenList,
  reorderCategories as reorderCategoriesRecord,
  updateCategory as updateCategoryRecord,
} from "services";
import type {
  CategoryFields as ServiceCategoryFields,
  CategoryListItem as ServiceCategoryListItem,
  CategoryListParams as ServiceCategoryListParams,
  SelectCategories as ServiceSelectCategories,
} from "services";
import type { PaginatedResult } from "utils";

// A "use server" file may only export async functions; types are re-declared as
// local aliases (not `export type { ... } from`, which the RSC compiler would
// treat as a runtime export) so consumers can keep importing them from here.
export type CategoryFields = ServiceCategoryFields;
export type CategoryListItem = ServiceCategoryListItem;
export type CategoryListParams = ServiceCategoryListParams;
export type SelectCategories = ServiceSelectCategories;

export type CategoryActionResult = {
  categoryUuid?: string;
  error?: string;
  success?: boolean;
};

// Reads pass straight through to the service — the admin pages/components call
// these from `./action`, keeping the transport boundary in one place.
export const getCategories = async (): Promise<CategoryListItem[]> =>
  getCategoriesList();

export const getCategoriesPage = async (
  params: CategoryListParams = {},
): Promise<PaginatedResult<CategoryListItem>> => getCategoriesPageList(params);

export const getCategoryChildren = async (
  parentUuid: string | null,
): Promise<CategoryListItem[]> => getCategoryChildrenList(parentUuid);

export const getCategory = async (
  uuid: string,
): Promise<SelectCategories | null> => getCategoryRecord(uuid);

export const createCategory = async (
  _prevState: CategoryActionResult,
  fields: CategoryFields,
): Promise<CategoryActionResult> => {
  try {
    await createCategoryRecord(fields);
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
    await updateCategoryRecord(uuid, fields);
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
    await deleteCategoryRecord(uuid);
    revalidatePath("/categories");
    return { success: true, categoryUuid: uuid };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete category",
    };
  }
};

export const reorderCategories = async (
  orderedUuids: string[],
): Promise<{ error?: string }> => {
  try {
    await reorderCategoriesRecord(orderedUuids);
    revalidatePath("/categories");
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to reorder categories",
    };
  }
};
