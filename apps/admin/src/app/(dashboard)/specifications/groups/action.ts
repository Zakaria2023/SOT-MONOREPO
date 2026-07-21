"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  createSpecificationGroup,
  deleteSpecificationGroup,
  reorderSpecificationGroups,
  updateSpecificationGroup,
} from "services";

export type GroupActionResult = {
  error?: string;
  success?: boolean;
};

const revalidate = () => {
  revalidatePath("/specifications/groups");
  revalidatePath("/specifications");
};

export const createGroupAction = async (
  name: string,
  domain: string | null,
): Promise<GroupActionResult> => {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Name is required" };
  }
  try {
    await createSpecificationGroup({ name: trimmed, domain: domain || null });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create group",
    };
  }
  revalidate();
  return { success: true };
};

export const updateGroupAction = async (
  uuid: string,
  name: string,
  domain: string | null,
): Promise<GroupActionResult> => {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Name is required" };
  }
  try {
    await updateSpecificationGroup(uuid, { name: trimmed, domain: domain || null });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update group",
    };
  }
  revalidate();
  return { success: true };
};

export const deleteGroupAction = async (
  uuid: string,
): Promise<GroupActionResult> => {
  await requireAdmin();
  try {
    await deleteSpecificationGroup(uuid);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete group",
    };
  }
  revalidate();
  return { success: true };
};

export const reorderGroupsAction = async (
  orderedUuids: string[],
): Promise<GroupActionResult> => {
  await requireAdmin();
  try {
    await reorderSpecificationGroups(orderedUuids);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to reorder groups",
    };
  }
  revalidatePath("/specifications");
  return { success: true };
};
