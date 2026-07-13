"use server";

import type { SpecOption } from "@/db/types";
import {
  createSpecification,
  deleteSpecification,
  updateSpecification,
} from "services";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type SpecificationActionInput = {
  label: string;
  key: string;
  options: SpecOption[];
  categoryUuids: string[];
};

export type SpecificationActionResult = {
  error?: string;
  success?: boolean;
};

export const createSpecificationAction = async (
  _prevState: SpecificationActionResult,
  input: SpecificationActionInput,
): Promise<SpecificationActionResult> => {
  const { categoryUuids, ...fields } = input;
  try {
    await createSpecification(fields, categoryUuids);
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
  const { categoryUuids, ...fields } = input;
  try {
    await updateSpecification(uuid, fields, categoryUuids);
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
