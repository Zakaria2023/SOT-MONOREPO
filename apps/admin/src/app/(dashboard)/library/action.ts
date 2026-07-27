"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  createLibraryAttribute,
  createProjectVariable,
  createSpecificationGroup,
  deleteLibraryAttribute,
  deleteProjectVariable,
  deleteSpecificationGroup,
  getLibrary,
  getProjectVariables,
  moveLibraryAttribute,
  reorderLibraryAttributes,
  reorderSpecificationGroups,
  updateLibraryAttribute,
  updateProjectVariable,
  updateSpecificationGroup,
  type LibraryAttributeInput as ServiceLibraryAttributeInput,
  type LibraryGroup as ServiceLibraryGroup,
  type ProjectVariableInput as ServiceProjectVariableInput,
  type SpecificationGroupFields as ServiceSpecificationGroupFields,
} from "services";

// Types re-declared as local aliases — a "use server" file may only export
// async functions.
export type LibraryAttributeInput = ServiceLibraryAttributeInput;
export type LibraryGroup = ServiceLibraryGroup;
export type ProjectVariableInput = ServiceProjectVariableInput;
export type SpecificationGroupFields = ServiceSpecificationGroupFields;

export type ActionResult = {
  error?: string;
  success?: boolean;
};

const fail = (error: unknown, fallback: string): ActionResult => ({
  error: error instanceof Error ? error.message : fallback,
});

export const getLibraryData = async (): Promise<LibraryGroup[]> => {
  await requireAdmin();
  return getLibrary();
};

export const getVariables = async () => {
  await requireAdmin();
  return getProjectVariables();
};

export const addAttributeAction = async (
  input: LibraryAttributeInput,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await createLibraryAttribute(input);
  } catch (error) {
    return fail(error, "Failed to create the attribute");
  }
  revalidatePath("/library");
  revalidatePath("/assignments");
  return { success: true };
};

export const updateAttributeAction = async (
  uuid: string,
  input: LibraryAttributeInput,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await updateLibraryAttribute(uuid, input);
  } catch (error) {
    return fail(error, "Failed to update the attribute");
  }
  revalidatePath("/library");
  revalidatePath("/assignments");
  return { success: true };
};

/**
 * Delete an attribute. The service REFUSES while any rule or assignment
 * references it, and its message names what is in the way — so this surfaces
 * that message rather than a generic failure.
 */
export const deleteAttributeAction = async (
  uuid: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await deleteLibraryAttribute(uuid);
  } catch (error) {
    return fail(error, "Failed to delete the attribute");
  }
  revalidatePath("/library");
  revalidatePath("/assignments");
  return { success: true };
};

export const moveAttributeAction = async (
  uuid: string,
  groupUuid: string | null,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await moveLibraryAttribute(uuid, groupUuid);
  } catch (error) {
    return fail(error, "Failed to move the attribute");
  }
  revalidatePath("/library");
  return { success: true };
};

export const reorderAttributesAction = async (
  order: { uuid: string; order: number }[],
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await reorderLibraryAttributes(order);
  } catch (error) {
    return fail(error, "Failed to reorder");
  }
  revalidatePath("/library");
  return { success: true };
};

// ---------------------------------------------------------------------------
// Groups — the folders an attribute is filed in.
//
// Filing only: a group is invisible to the shopper and to the engine. If one ever
// started affecting behaviour it would have become a second, weaker category
// tree, with two places to look for the same answer.
// ---------------------------------------------------------------------------

export const addGroupAction = async (
  fields: SpecificationGroupFields,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await createSpecificationGroup(fields);
  } catch (error) {
    return fail(error, "Failed to create the group");
  }
  revalidatePath("/library");
  return { success: true };
};

export const updateGroupAction = async (
  uuid: string,
  fields: SpecificationGroupFields,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await updateSpecificationGroup(uuid, fields);
  } catch (error) {
    return fail(error, "Failed to update the group");
  }
  revalidatePath("/library");
  return { success: true };
};

/**
 * Delete a group. The attributes inside it are NOT deleted — they become
 * ungrouped, because a group is a folder and emptying a folder must never
 * destroy what was filed in it.
 */
export const deleteGroupAction = async (
  uuid: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await deleteSpecificationGroup(uuid);
  } catch (error) {
    return fail(error, "Failed to delete the group");
  }
  revalidatePath("/library");
  return { success: true };
};

/** Persist a new group order — each uuid's position becomes its `order`. */
export const reorderGroupsAction = async (
  orderedUuids: string[],
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await reorderSpecificationGroups(orderedUuids);
  } catch (error) {
    return fail(error, "Failed to reorder the groups");
  }
  revalidatePath("/library");
  return { success: true };
};

export const addVariableAction = async (
  input: ProjectVariableInput,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await createProjectVariable(input);
  } catch (error) {
    return fail(error, "Failed to create the project input");
  }
  revalidatePath("/library");
  return { success: true };
};

export const updateVariableAction = async (
  uuid: string,
  input: ProjectVariableInput,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await updateProjectVariable(uuid, input);
  } catch (error) {
    return fail(error, "Failed to update the project input");
  }
  revalidatePath("/library");
  return { success: true };
};

export const deleteVariableAction = async (
  uuid: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await deleteProjectVariable(uuid);
  } catch (error) {
    return fail(error, "Failed to delete the project input");
  }
  revalidatePath("/library");
  return { success: true };
};
