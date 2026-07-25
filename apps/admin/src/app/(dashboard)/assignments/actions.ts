"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { setCategoryAssignments } from "services";
import type {
  AssignmentInput as ServiceAssignmentInput,
  CategoryAssignment as ServiceCategoryAssignment,
  PreviewCategory as ServicePreviewCategory,
  PreviewProduct as ServicePreviewProduct,
  ShopperPreview as ServiceShopperPreview,
  SpecificationWithCategories as ServiceSpecificationWithCategories,
} from "services";

// Types re-declared as local aliases — a "use server" file may only export
// async functions.
export type AssignmentInput = ServiceAssignmentInput;
export type CategoryAssignment = ServiceCategoryAssignment;
export type ShopperPreview = ServiceShopperPreview;
export type PreviewCategory = ServicePreviewCategory;
export type PreviewProduct = ServicePreviewProduct;
export type SpecificationWithCategories = ServiceSpecificationWithCategories;

export type SaveAssignmentsResult = {
  error?: string;
  success?: boolean;
};

/**
 * Save the assignments authored ON this category. Inherited rows are written
 * only once the admin has changed one — at that point it becomes an override
 * owned here, and the ancestor stops driving it.
 */
export const saveAssignments = async (
  categoryUuid: string,
  assignments: AssignmentInput[],
): Promise<SaveAssignmentsResult> => {
  await requireAdmin();
  try {
    await setCategoryAssignments(categoryUuid, assignments);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to save assignments",
    };
  }
  revalidatePath("/assignments");
  return { success: true };
};
