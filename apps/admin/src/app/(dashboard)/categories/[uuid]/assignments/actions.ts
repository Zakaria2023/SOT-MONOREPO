"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  getCategoryAssignmentRows,
  getSpecifications,
  setCategoryAssignments,
} from "services";
import type {
  AssignmentInput as ServiceAssignmentInput,
  CategoryAssignment as ServiceCategoryAssignment,
  SpecificationWithCategories as ServiceSpecificationWithCategories,
} from "services";

// Types re-declared as local aliases — a "use server" file may only export
// async functions.
export type CategoryAssignment = ServiceCategoryAssignment;
export type AssignmentInput = ServiceAssignmentInput;
export type SpecificationWithCategories = ServiceSpecificationWithCategories;

export type AssignmentActionResult = {
  error?: string;
  success?: boolean;
};

export const getAssignments = async (
  categoryUuid: string,
): Promise<CategoryAssignment[]> => {
  await requireAdmin();
  return getCategoryAssignmentRows(categoryUuid);
};

export const getLibraryAttributes = async (): Promise<
  SpecificationWithCategories[]
> => {
  await requireAdmin();
  return getSpecifications();
};

/**
 * Save the assignments authored on this category. Rows inherited from an
 * ancestor are only written when the admin has changed them — at that point
 * they become an override owned by this category.
 */
export const saveAssignments = async (
  categoryUuid: string,
  _prevState: AssignmentActionResult,
  assignments: AssignmentInput[],
): Promise<AssignmentActionResult> => {
  await requireAdmin();
  try {
    await setCategoryAssignments(categoryUuid, assignments);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to save assignments",
    };
  }
  revalidatePath(`/categories/${categoryUuid}/assignments`);
  revalidatePath("/library");
  return { success: true };
};
