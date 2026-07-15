"use server";

import type { SpecValueType } from "@/db/enum";
import type { SpecOption, SpecRule } from "@/db/types";
import {
  createSpecification,
  createSpecificationGroup,
  deleteSpecification,
  updateSpecification,
} from "services";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type SpecificationActionInput = {
  label: string;
  key: string;
  groupUuid: string;
  // When filled, a new group is created on save and wins over groupUuid.
  newGroupName: string;
  valueType: SpecValueType;
  unit: string;
  options: SpecOption[];
  rules: SpecRule[];
  categoryUuids: string[];
};

export type SpecificationActionResult = {
  error?: string;
  success?: boolean;
};

// A filled "new group" name creates the group on save; otherwise use the
// picked one (empty = no group).
const resolveGroupUuid = async (
  input: SpecificationActionInput,
): Promise<string | null> => {
  const newName = input.newGroupName.trim();
  if (newName) {
    return await createSpecificationGroup(newName);
  }
  return input.groupUuid || null;
};

// Normalize the form's empty strings to the nullable columns they map to.
// Dropdown specs never store a unit.
const toFields = async (input: SpecificationActionInput) => ({
  label: input.label,
  key: input.key,
  groupUuid: await resolveGroupUuid(input),
  valueType: input.valueType,
  unit: input.valueType === "number" ? input.unit.trim() || null : null,
  options: input.options,
  rules: input.rules,
});

export const createSpecificationAction = async (
  _prevState: SpecificationActionResult,
  input: SpecificationActionInput,
): Promise<SpecificationActionResult> => {
  const { categoryUuids } = input;
  try {
    await createSpecification(await toFields(input), categoryUuids);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create specification",
    };
  }

  revalidatePath("/specifications");
  redirect("/specifications");
};

export const updateSpecificationAction = async (
  uuid: string,
  _prevState: SpecificationActionResult,
  input: SpecificationActionInput,
): Promise<SpecificationActionResult> => {
  const { categoryUuids } = input;
  try {
    await updateSpecification(uuid, await toFields(input), categoryUuids);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update specification",
    };
  }

  revalidatePath("/specifications");
  redirect("/specifications");
};

export const deleteSpecificationAction = async (
  uuid: string,
): Promise<SpecificationActionResult> => {
  try {
    await deleteSpecification(uuid);
    revalidatePath("/specifications");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete specification",
    };
  }
};

