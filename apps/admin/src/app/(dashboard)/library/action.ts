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
  getAttributeCategories,
  getLibrary,
  getProjectVariables,
  removeAssignments,
  saveAssignments,
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
// The service input plus the categories the form lets an author tick. Kept as an
// ADMIN type on purpose: `createLibraryAttribute` still refuses to write category
// links, so the two writes stay separate and the assignment service remains the
// only thing that touches those rows.
export type LibraryAttributeInput = ServiceLibraryAttributeInput & {
  categoryUuids: string[];
};
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
  const { categoryUuids, ...definition } = input;
  try {
    const uuid = await createLibraryAttribute(definition);
    if (categoryUuids.length > 0) {
      await applyAttributeCategories(uuid, categoryUuids, true);
    }
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
  const { categoryUuids, ...definition } = input;
  try {
    await updateLibraryAttribute(uuid, definition);
    await applyAttributeCategories(uuid, categoryUuids);
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

/**
 * Apply a category selection by touching ONLY the difference.
 *
 * Not exported — a "use server" file may only export async functions, and this is
 * shared internal machinery rather than a server action.
 */
const applyAttributeCategories = async (
  specificationUuid: string,
  categoryUuids: string[],
  // Set when the attribute was created moments ago. Skips reading back links
  // that cannot exist, and the diff that would be against an empty set.
  justCreated = false,
): Promise<void> => {
  if (justCreated) {
    await saveAssignments(
      categoryUuids
        .filter((uuid) => uuid.length > 0)
        .map((categoryUuid) => ({
          categoryUuid,
          specificationUuid,
          isFilter: false,
          isRule: true,
          scope: "branch" as const,
          showIf: null,
          audience: "everyone" as const,
          enabledValues: null,
          suppressed: false,
          order: 0,
        })),
      { noneExistYet: true },
    );
    return;
  }

  const existing = await getAttributeCategories(specificationUuid);
  const wanted = new Set(categoryUuids.filter((uuid) => uuid.length > 0));
  const current = new Set(existing);

  // Both sides in BULK. As a loop this was a full catalog-model reload per
  // category — each write invalidates the cache, so the next one rebuilt it
  // just to validate — and four categories took about a minute against the
  // remote database.
  await saveAssignments(
    [...wanted]
      .filter((categoryUuid) => !current.has(categoryUuid))
      .map((categoryUuid) => ({
        categoryUuid,
        specificationUuid,
        // The engine reads it; the shopper does not filter on it until somebody
        // decides that deliberately on the assignments screen.
        isFilter: false,
        isRule: true,
        scope: "branch" as const,
        showIf: null,
        audience: "everyone" as const,
        enabledValues: null,
        suppressed: false,
        order: 0,
      })),
  );

  await removeAssignments(
    specificationUuid,
    [...current].filter((categoryUuid) => !wanted.has(categoryUuid)),
  );
};

/**
 * Set which categories use an attribute, from the library screen.
 *
 * ADDITIVE AND GUARDED, deliberately. The old version of this rewrote every
 * category link for the attribute — delete, then re-insert — which silently reset
 * whatever switches an author had set on the assignments screen. Renaming an
 * attribute could quietly change how a dozen categories used it.
 *
 * So this only ever touches the difference:
 *   - a newly ticked category gets a fresh assignment with sensible defaults
 *   - an unticked one is removed through the SAME guard the assignments screen
 *     uses, which refuses when another attribute's reveal depends on it
 *   - a category that was already ticked is left completely alone
 *
 * Everything else about an assignment — the filter switch, the slice, the reveal,
 * the audience — still has exactly one owner: the assignments screen.
 */
export const setAttributeCategoriesAction = async (
  specificationUuid: string,
  categoryUuids: string[],
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await applyAttributeCategories(specificationUuid, categoryUuids);
  } catch (error) {
    return fail(error, "Failed to update the categories");
  }
  revalidatePath("/library");
  revalidatePath("/assignments");
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
