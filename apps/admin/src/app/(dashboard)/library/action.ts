"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  createLibraryAttribute,
  createSpecificationGroup,
  createTemplateFromGroup,
  deleteLibraryAttribute,
  deleteSpecificationGroup,
  deleteSpecificationTemplate,
  getLibraryBuilder,
  getLibraryReadModel,
  getSpecificationTemplates,
  moveLibraryAttribute,
  reorderSpecificationGroups,
  updateLibraryAttribute,
  updateSpecificationGroup,
} from "services";
import type {
  AttributeInput as ServiceAttributeInput,
  LibraryBuilderGroup as ServiceLibraryBuilderGroup,
  LibraryReadModel as ServiceLibraryReadModel,
  SelectSpecificationTemplates as ServiceSelectSpecificationTemplates,
} from "services";

// Types re-declared as local aliases (a "use server" file may only export
// async functions).
export type AttributeInput = ServiceAttributeInput;
export type LibraryBuilderGroup = ServiceLibraryBuilderGroup;
export type LibraryReadModel = ServiceLibraryReadModel;
export type SpecificationTemplate = ServiceSelectSpecificationTemplates;

export type LibraryActionResult = { error?: string };

const revalidate = () => revalidatePath("/library");

const fail = (error: unknown, fallback: string): LibraryActionResult => ({
  error: error instanceof Error ? error.message : fallback,
});

// --- Reads ---
export const getBuilder = async (): Promise<LibraryBuilderGroup[]> => {
  await requireAdmin();
  return getLibraryBuilder();
};

export const getReadModel = async (): Promise<LibraryReadModel> => {
  await requireAdmin();
  return getLibraryReadModel();
};

export const getTemplates = async (): Promise<SpecificationTemplate[]> => {
  await requireAdmin();
  return getSpecificationTemplates();
};

// --- Groups ---
export const addGroupAction = async (
  name: string,
  domain: string | null,
): Promise<LibraryActionResult> => {
  await requireAdmin();
  if (!name.trim()) {
    return { error: "Name is required" };
  }
  try {
    await createSpecificationGroup({ name: name.trim(), domain });
  } catch (error) {
    return fail(error, "Failed to add group");
  }
  revalidate();
  return {};
};

// Saves the group's name and domain together — both come from the same inline
// editor, so neither is ever written blind over the other.
export const updateGroupAction = async (
  uuid: string,
  name: string,
  domain: string | null,
): Promise<LibraryActionResult> => {
  await requireAdmin();
  if (!name.trim()) {
    return { error: "Name is required" };
  }
  try {
    await updateSpecificationGroup(uuid, { name: name.trim(), domain });
  } catch (error) {
    return fail(error, "Failed to update group");
  }
  revalidate();
  return {};
};

export const deleteGroupAction = async (
  uuid: string,
): Promise<LibraryActionResult> => {
  await requireAdmin();
  try {
    await deleteSpecificationGroup(uuid);
  } catch (error) {
    return fail(error, "Failed to delete group");
  }
  revalidate();
  return {};
};

export const reorderGroupsAction = async (
  orderedUuids: string[],
): Promise<LibraryActionResult> => {
  await requireAdmin();
  try {
    await reorderSpecificationGroups(orderedUuids);
  } catch (error) {
    return fail(error, "Failed to reorder groups");
  }
  revalidate();
  return {};
};

// --- Attributes ---
export const addAttributeAction = async (
  input: AttributeInput,
): Promise<LibraryActionResult> => {
  await requireAdmin();
  if (!input.label.trim()) {
    return { error: "Name is required" };
  }
  try {
    await createLibraryAttribute({ ...input, label: input.label.trim() });
  } catch (error) {
    return fail(error, "Failed to add attribute");
  }
  revalidate();
  return {};
};

export const updateAttributeAction = async (
  uuid: string,
  input: AttributeInput,
): Promise<LibraryActionResult> => {
  await requireAdmin();
  if (!input.label.trim()) {
    return { error: "Name is required" };
  }
  try {
    await updateLibraryAttribute(uuid, { ...input, label: input.label.trim() });
  } catch (error) {
    return fail(error, "Failed to update attribute");
  }
  revalidate();
  return {};
};

export const deleteAttributeAction = async (
  uuid: string,
): Promise<LibraryActionResult> => {
  await requireAdmin();
  try {
    await deleteLibraryAttribute(uuid);
  } catch (error) {
    return fail(error, "Failed to delete attribute");
  }
  revalidate();
  return {};
};

export const moveAttributeAction = async (
  uuid: string,
  groupUuid: string | null,
): Promise<LibraryActionResult> => {
  await requireAdmin();
  try {
    await moveLibraryAttribute(uuid, groupUuid);
  } catch (error) {
    return fail(error, "Failed to move attribute");
  }
  revalidate();
  return {};
};

// --- Templates ---
export const createTemplateFromGroupAction = async (
  groupUuid: string,
): Promise<LibraryActionResult> => {
  await requireAdmin();
  try {
    await createTemplateFromGroup(groupUuid);
  } catch (error) {
    return fail(error, "Failed to create template");
  }
  revalidate();
  return {};
};

export const deleteTemplateAction = async (
  uuid: string,
): Promise<LibraryActionResult> => {
  await requireAdmin();
  try {
    await deleteSpecificationTemplate(uuid);
  } catch (error) {
    return fail(error, "Failed to delete template");
  }
  revalidate();
  return {};
};
