"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BrandBoardItem,
  BrandFields,
  createBrand as createBrandRecord,
  deleteBrand as deleteBrandRecord,
  getBrandChildren as getBrandChildrenList,
  moveBrandToParent as moveBrandToParentRecord,
  reorderBrandChildren as reorderBrandChildrenRecord,
  updateBrand as updateBrandRecord,
} from "services";
import { ActionResult, fail } from "utils";

// Only what a "use client" file has to reach through an action lives here. The
// reads a server component makes — getBrands, getBrand — go straight to
// services, the way apps/api and apps/client already call them. Wrapping them
// bought nothing and cost every wrapper an alias, since the wrapper and the
// service function want the same name.
export type BrandActionResult = ActionResult & { brandUuid?: string };

// One column's cards — the top-level cards when parentUuid is null, otherwise a
// single parent's direct children. Each card carries its own childCount, so the
// board never has to load any other column to know what is expandable. This is
// both the first-render fetch (null) and every lazy column open.
export const getBrandChildren = async (
  parentUuid: string | null,
): Promise<BrandBoardItem[]> => getBrandChildrenList(parentUuid);

export const createBrand = async (
  _prevState: BrandActionResult,
  fields: BrandFields,
): Promise<BrandActionResult> => {
  await requireAdmin();
  try {
    await createBrandRecord(fields);
  } catch (error) {
    return fail(error, "Failed to create brand");
  }

  revalidatePath("/brands");
  redirect("/brands");
};

export const updateBrand = async (
  uuid: string,
  _prevState: BrandActionResult,
  fields: BrandFields,
): Promise<BrandActionResult> => {
  await requireAdmin();
  try {
    await updateBrandRecord(uuid, fields);
  } catch (error) {
    return fail(error, "Failed to update brand");
  }

  revalidatePath("/brands");
  redirect("/brands");
};

export const deleteBrand = async (uuid: string): Promise<BrandActionResult> => {
  await requireAdmin();
  try {
    await deleteBrandRecord(uuid);
    revalidatePath("/brands");
    return { success: true, brandUuid: uuid };
  } catch (error) {
    return fail(error, "Failed to delete brand");
  }
};

// Move a card into another column (re-parent) at the dropped position. This is
// a structural change (counts shift, columns may appear/disappear), so it
// revalidates the board.
export const moveBrandToParent = async (
  uuid: string,
  newParentUuid: string | null,
  targetIndex: number,
): Promise<{ error?: string }> => {
  await requireAdmin();
  try {
    await moveBrandToParentRecord(uuid, newParentUuid, targetIndex);
    revalidatePath("/brands");
    return {};
  } catch (error) {
    return fail(error, "Failed to move brand");
  }
};

// Reorder within one paginated board column: only the reordered page window is
// sent; the service splices it into the parent's full ordered list.
export const reorderBrandChildren = async (
  parentUuid: string | null,
  pageStart: number,
  orderedPageUuids: string[],
): Promise<{ error?: string }> => {
  await requireAdmin();
  try {
    await reorderBrandChildrenRecord(parentUuid, pageStart, orderedPageUuids);
    // No revalidatePath here: the column already reflects the new order
    // optimistically, and revalidating would snap every column back to page 1.
    return {};
  } catch (error) {
    return fail(error, "Failed to reorder brands");
  }
};
