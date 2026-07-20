"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCategory as createCategoryRecord,
  deleteCategory as deleteCategoryRecord,
  getCategories as getCategoriesList,
  getCategoriesPage as getCategoriesPageList,
  getCategory as getCategoryRecord,
  getCategoryBoard as getCategoryBoardRecord,
  getCategoryChildren as getCategoryChildrenList,
  getCategoryChildrenPage as getCategoryChildrenPageList,
  moveCategoryToParent as moveCategoryToParentRecord,
  reorderCategories as reorderCategoriesRecord,
  reorderCategoryChildren as reorderCategoryChildrenRecord,
  updateCategory as updateCategoryRecord,
} from "services";
import type {
  CategoryBoardColumn as ServiceCategoryBoardColumn,
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
export type CategoryBoardColumn = ServiceCategoryBoardColumn;
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

export const getCategoryBoard = async (): Promise<CategoryBoardColumn[]> =>
  getCategoryBoardRecord();

export const getCategoryChildrenPage = async (
  parentUuid: string | null,
  page: number,
): Promise<CategoryListItem[]> => getCategoryChildrenPageList(parentUuid, page);

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

// Move a card into another column (re-parent) at the dropped position. This is
// a structural change (counts shift, columns may appear/disappear), so it
// revalidates the board.
export const moveCategoryToParent = async (
  uuid: string,
  newParentUuid: string | null,
  targetIndex: number,
): Promise<{ error?: string }> => {
  try {
    await moveCategoryToParentRecord(uuid, newParentUuid, targetIndex);
    revalidatePath("/categories");
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to move category",
    };
  }
};

// Reorder within one paginated board column: only the reordered page window is
// sent; the service splices it into the parent's full ordered list.
export const reorderCategoryChildren = async (
  parentUuid: string | null,
  pageStart: number,
  orderedPageUuids: string[],
): Promise<{ error?: string }> => {
  try {
    await reorderCategoryChildrenRecord(parentUuid, pageStart, orderedPageUuids);
    // No revalidatePath here: the column already reflects the new order
    // optimistically, and revalidating would snap every column back to page 1.
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to reorder categories",
    };
  }
};
