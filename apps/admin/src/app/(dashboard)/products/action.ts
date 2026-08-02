"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AddOptionRequest,
  AddOptionResult,
  ProductClientFields,
  addAttributeOption as addAttributeOptionRecord,
  createProduct as createProductRecord,
  deleteProduct as deleteProductRecord,
  updateProduct as updateProductRecord,
} from "services";
import { ActionResult, fail } from "utils";

export type ProductActionResult = ActionResult & { productUuid?: string };

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
