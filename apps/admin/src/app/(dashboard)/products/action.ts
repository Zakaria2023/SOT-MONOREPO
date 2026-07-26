"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProduct as createProductRecord,
  deleteProduct as deleteProductRecord,
  getProduct as getProductRecord,
  getProductDetailByUuid as getProductDetailByUuidRecord,
  getProductsPage as getProductsPageList,
  updateProduct as updateProductRecord,
} from "services";
import type {
  ProductClientFields as ServiceProductClientFields,
  ProductDetail as ServiceProductDetail,
  ProductFields as ServiceProductFields,
  ProductListItem as ServiceProductListItem,
  ProductListParams as ServiceProductListParams,
  SelectProducts as ServiceSelectProducts,
} from "services";
import type { PaginatedResult } from "utils";

// A "use server" file may only export async functions; types are re-declared as
// local aliases (not `export type { ... } from`, which the RSC compiler would
// treat as a runtime export) so consumers can keep importing them from here.
export type ProductFields = ServiceProductFields;
export type ProductClientFields = ServiceProductClientFields;
export type ProductListItem = ServiceProductListItem;
export type ProductListParams = ServiceProductListParams;
export type ProductDetail = ServiceProductDetail;
export type SelectProducts = ServiceSelectProducts;

export type ProductActionResult = {
  productUuid?: string;
  error?: string;
  success?: boolean;
};

// Reads pass straight through to the service — the admin pages/components call
// these from `./action`, keeping the transport boundary in one place.
export const getProductsPage = async (
  params: ProductListParams = {},
): Promise<PaginatedResult<ProductListItem>> => getProductsPageList(params);

export const getProduct = async (
  uuid: string,
): Promise<SelectProducts | null> => getProductRecord(uuid);

export const getProductDetail = async (
  uuid: string,
): Promise<ProductDetail | null> => getProductDetailByUuidRecord(uuid);

export const createProduct = async (
  _prevState: ProductActionResult,
  fields: ProductClientFields,
): Promise<ProductActionResult> => {
  await requireAdmin();
  try {
    await createProductRecord(fields);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create product",
    };
  }

  revalidatePath("/products");
  redirect("/products");
};

export const updateProduct = async (
  uuid: string,
  _prevState: ProductActionResult,
  fields: ProductClientFields,
): Promise<ProductActionResult> => {
  await requireAdmin();
  try {
    await updateProductRecord(uuid, fields);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update product",
    };
  }

  revalidatePath("/products");
  redirect("/products");
};

export const deleteProduct = async (
  uuid: string,
): Promise<ProductActionResult> => {
  await requireAdmin();
  try {
    await deleteProductRecord(uuid);
    revalidatePath("/products");
    return { success: true, productUuid: uuid };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete product",
    };
  }
};
