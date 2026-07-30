"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  createRelationship,
  deleteRelationship,
  previewRelationship,
  removeAssignment,
  saveAssignment,
  searchProductsForPicker,
  suppressInherited,
  updateRelationship,
  validateRelationship,
  type AssignmentInput as ServiceAssignmentInput,
  type ProductPickerItem as ServiceProductPickerItem,
  type RelationshipInput as ServiceRelationshipInput,
  type RelationshipPreview as ServiceRelationshipPreview,
  type RelationshipProblem as ServiceRelationshipProblem,
} from "services";

// Types re-declared as local aliases — a "use server" file may only export
// async functions.
export type AssignmentInput = ServiceAssignmentInput;
export type ProductPickerItem = ServiceProductPickerItem;
export type RelationshipInput = ServiceRelationshipInput;
export type RelationshipPreview = ServiceRelationshipPreview;
export type RelationshipProblem = ServiceRelationshipProblem;

export type ActionResult = {
  error?: string;
  success?: boolean;
};

const fail = (error: unknown, fallback: string): ActionResult => ({
  error: error instanceof Error ? error.message : fallback,
});

const refreshCatalog = (): void => {
  revalidatePath("/assignments");
  revalidatePath("/products");
};

/**
 * Save one assignment. The service refuses a reveal that names a trigger this
 * category does not carry, or one that closes a cycle — both would leave a field
 * permanently hidden with nothing to say so.
 */
export const saveAssignmentAction = async (
  input: AssignmentInput,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await saveAssignment(input, actor);
  } catch (error) {
    return fail(error, "Failed to save the assignment");
  }
  refreshCatalog();
  return { success: true };
};

export const removeAssignmentAction = async (
  categoryUuid: string,
  specificationUuid: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await removeAssignment(categoryUuid, specificationUuid, actor);
  } catch (error) {
    return fail(error, "Failed to remove the assignment");
  }
  refreshCatalog();
  return { success: true };
};

/** Drop an inherited attribute on this category only. */
export const suppressAssignmentAction = async (
  categoryUuid: string,
  specificationUuid: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await suppressInherited(categoryUuid, specificationUuid, actor);
  } catch (error) {
    return fail(error, "Failed to suppress the attribute");
  }
  refreshCatalog();
  return { success: true };
};

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const validateRelationAction = async (
  input: RelationshipInput,
): Promise<RelationshipProblem[]> => {
  await requireAdmin();
  return validateRelationship(input);
};

export const addRelationAction = async (
  input: RelationshipInput,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await createRelationship(input, actor);
  } catch (error) {
    return fail(error, "Failed to create the relation");
  }
  refreshCatalog();
  return { success: true };
};

export const updateRelationAction = async (
  uuid: string,
  input: RelationshipInput,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await updateRelationship(uuid, input, actor);
  } catch (error) {
    return fail(error, "Failed to update the relation");
  }
  refreshCatalog();
  return { success: true };
};

export const deleteRelationAction = async (
  uuid: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await deleteRelationship(uuid, actor);
  } catch (error) {
    return fail(error, "Failed to delete the relation");
  }
  refreshCatalog();
  return { success: true };
};

/**
 * Products matching a search term, for the preview's picker.
 *
 * A query rather than a mutation, but still an action: the alternative is a
 * route handler duplicating what the service already does.
 */
export const searchProductsAction = async (
  search: string,
): Promise<ProductPickerItem[]> => {
  await requireAdmin();
  if (search.trim().length < 2) {
    return [];
  }
  try {
    return await searchProductsForPicker(search);
  } catch {
    return [];
  }
};

/**
 * Run a rule against a real selection before anyone is blocked by it.
 *
 * The author reads the finding their rule produces, in the buyer's own words,
 * against a basket they choose — which is how a rule gets reviewed now that
 * there is no draft state to sit in.
 */
export const previewRelationAction = async (
  uuid: string,
  selection: { productUuid: string; quantity: number }[],
  variables: Record<string, number | boolean> = {},
): Promise<{ preview?: RelationshipPreview; error?: string }> => {
  await requireAdmin();
  try {
    const preview = await previewRelationship(uuid, selection, variables);
    if (!preview) {
      return { error: "That rule no longer exists." };
    }
    return { preview };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to run the preview",
    };
  }
};
