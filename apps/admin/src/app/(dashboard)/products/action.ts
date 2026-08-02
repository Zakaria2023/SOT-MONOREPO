"use server";

import type { ProductValues } from "@/db/types";
import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addAttributeOption as addAttributeOptionRecord,
  createProduct as createProductRecord,
  deleteProduct as deleteProductRecord,
  getProduct as getProductRecord,
  getProductDetailByUuid as getProductDetailByUuidRecord,
  getProductSpecsForDisplay as getProductSpecsForDisplayRecord,
  getProductsPage as getProductsPageList,
  updateProduct as updateProductRecord,
} from "services";
import type {
  AddOptionRequest as ServiceAddOptionRequest,
  AddOptionResult as ServiceAddOptionResult,
  DisplaySpec as ServiceDisplaySpec,
  ProductClientFields as ServiceProductClientFields,
  ProductDetail as ServiceProductDetail,
  ProductFields as ServiceProductFields,
  ProductListItem as ServiceProductListItem,
  ProductListParams as ServiceProductListParams,
  SelectProducts as ServiceSelectProducts,
} from "services";
import type { PaginatedResult } from "utils";
import { fail } from "utils";

// A "use server" file may only export async functions; types are re-declared as
// local aliases (not `export type { ... } from`, which the RSC compiler would
// treat as a runtime export) so consumers can keep importing them from here.
export type ProductFields = ServiceProductFields;
export type ProductClientFields = ServiceProductClientFields;
export type ProductListItem = ServiceProductListItem;
export type ProductListParams = ServiceProductListParams;
export type ProductDetail = ServiceProductDetail;
export type SelectProducts = ServiceSelectProducts;
export type DisplaySpec = ServiceDisplaySpec;
export type AddOptionRequest = ServiceAddOptionRequest;
export type AddOptionResult = ServiceAddOptionResult;

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

// "admin" so the panel shows partner-only and staff-only attributes: this is
// where the catalog is authored, and an attribute an author cannot see is one they
// cannot notice is wrong.
/**
 * Add one value to a library list, from the product form.
 *
 * Thin, like every action here: the service owns whether it is a near-duplicate,
 * which of the four possible lists it belongs to, and whether the category's
 * slice has to be widened for it to appear.
 *
 * No `revalidatePath` — the form is half-filled and a revalidation would throw
 * away everything the author has typed so far. The caller splices the returned
 * option into the field it is standing on.
 */
export const addSpecOption = async (
  request: AddOptionRequest,
): Promise<AddOptionResult | { error: string }> => {
  const { actor } = await requireAdmin();
  try {
    return await addAttributeOptionRecord(request, actor);
  } catch (error) {
    return fail(error, "Failed to add the value");
  }
};

export const getProductSpecs = async (
  categoryUuid: string,
  values: ProductValues,
): Promise<DisplaySpec[]> =>
  getProductSpecsForDisplayRecord(categoryUuid, values, "admin");

export const createProduct = async (
  _prevState: ProductActionResult,
  fields: ProductClientFields,
): Promise<ProductActionResult> => {
  await requireAdmin();
  try {
    await createProductRecord(fields);
  } catch (error) {
    return fail(error, "Failed to create product");
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
    return fail(error, "Failed to update product");
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
    return fail(error, "Failed to delete product");
  }
};
