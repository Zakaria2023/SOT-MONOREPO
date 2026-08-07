"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  createRelationship,
  deleteRelationship,
  listRelationshipVersions,
  previewRelationship,
  removeAssignment,
  restoreRelationshipVersion,
  saveAssignment,
  searchProductsForPicker,
  suppressInherited,
  updateRelationship,
  validateRelationship,
} from "services";
import type {
  AssignmentInput,
  ProductPickerItem,
  RelationshipInput,
  RelationshipPreview,
  RelationshipProblem,
  RelationshipVersionEntry,
} from "services";
import { fail, type ActionResult } from "utils";

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

// Relations

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
    return fail(error, "Failed to run the preview");
  }
};

/**
 * Every state a rule has been in, with what each save changed.
 *
 * The audit trail knows a rule was edited and by whom; it diffs three scalar
 * fields, so re-pointing a rule at a different attribute left no trace anywhere.
 * This reads the stored snapshots instead.
 */
export const listRelationVersionsAction = async (
  uuid: string,
): Promise<RelationshipVersionEntry[]> => {
  await requireAdmin();
  return listRelationshipVersions(uuid);
};

/**
 * Put a rule back the way it was.
 *
 * Forward, never destructive: it saves the old snapshot as a new version, so the
 * history shows the restore instead of hiding what it undid. The ordinary save
 * validation applies, which is what stops a snapshot naming a since-deleted
 * attribute being resurrected as a rule that silently never runs.
 */
export const restoreRelationVersionAction = async (
  uuid: string,
  version: number,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await restoreRelationshipVersion(uuid, version, actor);
    refreshCatalog();
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to restore that version");
  }
};
