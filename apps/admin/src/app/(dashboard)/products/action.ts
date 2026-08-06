"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AddOptionRequest,
  AddOptionResult,
  CompatibilityInput,
  CompositionInput,
  ProductClientFields,
  Variant,
  VariantInput,
  addAttributeOption as addAttributeOptionRecord,
  addCompatibilityLink as addCompatibilityRecord,
  addCompositionLink as addCompositionRecord,
  createProduct as createProductRecord,
  createVariant as createVariantRecord,
  deleteProduct as deleteProductRecord,
  removeCompatibilityLink as removeCompatibilityRecord,
  removeCompositionLink as removeCompositionRecord,
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

/**
 * Add a variant to the vocabulary, from the product form.
 *
 * Same shape as `addSpecOption` and for the same reason: the author is standing
 * in a half-filled form, so this returns the new variant for the picker to
 * splice in rather than revalidating the page and throwing away their work.
 *
 * The service owns whether the name is a second spelling of a variant that
 * already exists — that judgement is the reason variants are a table at all.
 */
export const addVariant = async (
  input: VariantInput,
): Promise<Variant | { error: string }> => {
  await requireAdmin();
  try {
    return await createVariantRecord(input);
  } catch (error) {
    return fail(error, "Failed to add the variant");
  }
};

// ---------------------------------------------------------------------------
// The two product-to-product facts.
//
// `revalidatePath` on the product's own page rather than a redirect: these are
// small records authored beside the product, and each one saves on its own. The
// author stays where they are and the list under the form refreshes.
// ---------------------------------------------------------------------------

export const addCompatibility = async (
  input: CompatibilityInput,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await addCompatibilityRecord(input);
  } catch (error) {
    return fail(error, "Failed to record the pair");
  }
  revalidatePath(`/products/${input.productUuidA}`);
  return { success: true };
};

export const removeCompatibility = async (
  uuid: string,
  productUuid: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await removeCompatibilityRecord(uuid);
  } catch (error) {
    return fail(error, "Failed to remove the pair");
  }
  revalidatePath(`/products/${productUuid}`);
  return { success: true };
};

export const addComposition = async (
  input: CompositionInput,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await addCompositionRecord(input);
  } catch (error) {
    return fail(error, "Failed to add the part");
  }
  revalidatePath(`/products/${input.parentUuid}`);
  return { success: true };
};

export const removeComposition = async (
  uuid: string,
  productUuid: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await removeCompositionRecord(uuid);
  } catch (error) {
    return fail(error, "Failed to remove the part");
  }
  revalidatePath(`/products/${productUuid}`);
  return { success: true };
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
