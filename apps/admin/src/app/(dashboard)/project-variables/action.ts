"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  createProjectVariable,
  deleteProjectVariable,
  getProjectVariables,
  updateProjectVariable,
} from "services";
import type {
  ProjectVariableFields as ServiceProjectVariableFields,
  ProjectVariableListItem as ServiceProjectVariableListItem,
} from "services";

// Types re-declared as local aliases — a "use server" file may only export
// async functions.
export type ProjectVariableFields = ServiceProjectVariableFields;
export type ProjectVariableListItem = ServiceProjectVariableListItem;

export type ProjectVariableActionResult = { error?: string };

const revalidate = () => {
  revalidatePath("/project-variables");
  revalidatePath("/rules");
};

const fail = (
  error: unknown,
  fallback: string,
): ProjectVariableActionResult => ({
  error: error instanceof Error ? error.message : fallback,
});

export const getVariables = async (): Promise<ProjectVariableListItem[]> => {
  await requireAdmin();
  return getProjectVariables();
};

export const addVariable = async (
  fields: ProjectVariableFields,
): Promise<ProjectVariableActionResult> => {
  await requireAdmin();
  try {
    await createProjectVariable(fields);
  } catch (error) {
    return fail(error, "Failed to create the variable");
  }
  revalidate();
  return {};
};

export const editVariable = async (
  uuid: string,
  fields: ProjectVariableFields,
): Promise<ProjectVariableActionResult> => {
  await requireAdmin();
  try {
    await updateProjectVariable(uuid, fields);
  } catch (error) {
    return fail(error, "Failed to update the variable");
  }
  revalidate();
  return {};
};

export const removeVariable = async (
  uuid: string,
): Promise<ProjectVariableActionResult> => {
  await requireAdmin();
  try {
    await deleteProjectVariable(uuid);
  } catch (error) {
    return fail(error, "Failed to delete the variable");
  }
  revalidate();
  return {};
};
