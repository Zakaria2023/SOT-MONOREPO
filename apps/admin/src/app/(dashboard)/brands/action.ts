"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBrand as createBrandRecord,
  deleteBrand as deleteBrandRecord,
  getBrand as getBrandRecord,
  getBrandChildren as getBrandChildrenList,
  getBrands as getBrandsList,
  getBrandsPage as getBrandsPageList,
  reorderBrands as reorderBrandsRecord,
  updateBrand as updateBrandRecord,
  type BrandFields,
  type BrandListItem,
  type BrandListParams,
  type SelectBrands,
} from "services";
import type { PaginatedResult } from "utils";

export type { BrandFields, BrandListItem, BrandListParams, SelectBrands };

export type BrandActionResult = {
  brandUuid?: string;
  error?: string;
  success?: boolean;
};

// Reads pass straight through to the service — the admin pages/components call
// these from `./action`, keeping the transport boundary in one place.
export const getBrands = (): Promise<BrandListItem[]> => getBrandsList();

export const getBrandsPage = (
  params: BrandListParams = {},
): Promise<PaginatedResult<BrandListItem>> => getBrandsPageList(params);

export const getBrandChildren = (
  parentUuid: string | null,
): Promise<BrandListItem[]> => getBrandChildrenList(parentUuid);

export const getBrand = (uuid: string): Promise<SelectBrands | null> =>
  getBrandRecord(uuid);

export const createBrand = async (
  _prevState: BrandActionResult,
  fields: BrandFields,
): Promise<BrandActionResult> => {
  try {
    await createBrandRecord(fields);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create brand",
    };
  }

  revalidatePath("/brands");
  redirect("/brands");
};

export const updateBrand = async (
  uuid: string,
  _prevState: BrandActionResult,
  fields: BrandFields,
): Promise<BrandActionResult> => {
  try {
    await updateBrandRecord(uuid, fields);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update brand",
    };
  }

  revalidatePath("/brands");
  redirect("/brands");
};

export const deleteBrand = async (
  uuid: string,
): Promise<BrandActionResult> => {
  try {
    await deleteBrandRecord(uuid);
    revalidatePath("/brands");
    return { success: true, brandUuid: uuid };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete brand",
    };
  }
};

export const reorderBrands = async (
  orderedUuids: string[],
): Promise<{ error?: string }> => {
  try {
    await reorderBrandsRecord(orderedUuids);
    revalidatePath("/brands");
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to reorder brands",
    };
  }
};
