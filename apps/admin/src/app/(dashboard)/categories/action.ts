"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CategoryBoardItem,
  CategoryFields,
  createCategory as createCategoryRecord,
  deleteCategory as deleteCategoryRecord,
  getCategoryChildren as getCategoryChildrenList,
  moveCategoryToParent as moveCategoryToParentRecord,
  reorderCategoryChildren as reorderCategoryChildrenRecord,
  updateCategory as updateCategoryRecord,
} from "services";
import { ActionResult, fail } from "utils";

// Only what a "use client" file has to reach through an action lives here. The
// reads a server component makes — getCategories, getCategory — go straight to
// services. Wrapping them bought nothing and cost every wrapper an alias, since
// the wrapper and the service function want the same name.
export type CategoryActionResult = ActionResult & { categoryUuid?: string };

// One column's cards — the top-level cards when parentUuid is null, otherwise a
// single parent's direct children. Each card carries its own childCount, so the
// board never has to load any other column to know what is expandable. This is
// both the first-render fetch (null) and every lazy column open.
export const getCategoryChildren = async (
  parentUuid: string | null,
): Promise<CategoryBoardItem[]> => getCategoryChildrenList(parentUuid);

export const createCategory = async (
  _prevState: CategoryActionResult,
  fields: CategoryFields,
): Promise<CategoryActionResult> => {
  await requireAdmin();
  try {
    await createCategoryRecord(fields);
  } catch (error) {
    return fail(error, "Failed to create category");
  }

  revalidatePath("/categories");
  redirect("/categories");
};

export const updateCategory = async (
  uuid: string,
  _prevState: CategoryActionResult,
  fields: CategoryFields,
): Promise<CategoryActionResult> => {
  await requireAdmin();
  try {
    await updateCategoryRecord(uuid, fields);
  } catch (error) {
    return fail(error, "Failed to update category");
  }

  revalidatePath("/categories");
  redirect("/categories");
};

export const deleteCategory = async (
  uuid: string,
): Promise<CategoryActionResult> => {
  await requireAdmin();
  try {
    await deleteCategoryRecord(uuid);
    revalidatePath("/categories");
    return { success: true, categoryUuid: uuid };
  } catch (error) {
    return fail(error, "Failed to delete category");
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
  await requireAdmin();
  try {
    await moveCategoryToParentRecord(uuid, newParentUuid, targetIndex);
    revalidatePath("/categories");
    return {};
  } catch (error) {
    return fail(error, "Failed to move category");
  }
};

// Reorder within one paginated board column: only the reordered page window is
// sent; the service splices it into the parent's full ordered list.
export const reorderCategoryChildren = async (
  parentUuid: string | null,
  pageStart: number,
  orderedPageUuids: string[],
): Promise<{ error?: string }> => {
  await requireAdmin();
  try {
    await reorderCategoryChildrenRecord(
      parentUuid,
      pageStart,
      orderedPageUuids,
    );
    // No revalidatePath here: the column already reflects the new order
    // optimistically, and revalidating would snap every column back to page 1.
    return {};
  } catch (error) {
    return fail(error, "Failed to reorder categories");
  }
};
