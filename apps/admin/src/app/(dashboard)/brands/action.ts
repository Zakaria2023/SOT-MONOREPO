"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBrand as createBrandRecord,
  deleteBrand as deleteBrandRecord,
  getBrand as getBrandRecord,
  getBrandBoard as getBrandBoardRecord,
  getBrandChildren as getBrandChildrenList,
  getBrandChildrenPage as getBrandChildrenPageList,
  getBrands as getBrandsList,
  getBrandsPage as getBrandsPageList,
  moveBrandToParent as moveBrandToParentRecord,
  reorderBrandChildren as reorderBrandChildrenRecord,
  reorderBrands as reorderBrandsRecord,
  updateBrand as updateBrandRecord,
} from "services";
import type {
  BrandBoardColumn,
  BrandBoardItem,
  BrandFields,
  BrandListItem,
  BrandListParams,
  SelectBrands,
} from "services";
import type { PaginatedResult } from "utils";
import { fail, type ActionResult } from "utils";

// A "use server" file may only export async functions; types are re-declared as
// local aliases (not `export type { ... } from`, which the RSC compiler would
// treat as a runtime export) so consumers can keep importing them from here.

export type BrandActionResult = ActionResult & { brandUuid?: string };

// Reads pass straight through to the service — the admin pages/components call
// these from `./action`, keeping the transport boundary in one place.
export const getBrands = async (): Promise<BrandListItem[]> => getBrandsList();

export const getBrandsPage = async (
  params: BrandListParams = {},
): Promise<PaginatedResult<BrandListItem>> => getBrandsPageList(params);

// One column's cards — the top-level cards when parentUuid is null, otherwise a
// single parent's direct children. Each card carries its own childCount, so the
// board never has to load any other column to know what is expandable. This is
// both the first-render fetch (null) and every lazy column open.
export const getBrandChildren = async (
  parentUuid: string | null,
): Promise<BrandBoardItem[]> => getBrandChildrenList(parentUuid);

export const getBrandBoard = async (): Promise<BrandBoardColumn[]> =>
  getBrandBoardRecord();

export const getBrandChildrenPage = async (
  parentUuid: string | null,
  page: number,
): Promise<BrandListItem[]> => getBrandChildrenPageList(parentUuid, page);

export const getBrand = async (uuid: string): Promise<SelectBrands | null> =>
  getBrandRecord(uuid);

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

export const reorderBrands = async (
  orderedUuids: string[],
): Promise<{ error?: string }> => {
  await requireAdmin();
  try {
    await reorderBrandsRecord(orderedUuids);
    revalidatePath("/brands");
    return {};
  } catch (error) {
    return fail(error, "Failed to reorder brands");
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
