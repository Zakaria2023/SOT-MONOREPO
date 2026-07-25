"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  createCompatibilityRule,
  deleteCompatibilityRule,
  setCategoryAssignments,
} from "services";
import type { RuleComparator, RuleKind, RuleSeverity } from "@/db/enum";
import type { LookupRow } from "@/db/types";
import type {
  AssignmentInput as ServiceAssignmentInput,
  CategoryAssignment as ServiceCategoryAssignment,
  SpecRelation as ServiceSpecRelation,
  SpecificationWithCategories as ServiceSpecificationWithCategories,
} from "services";

// Types re-declared as local aliases — a "use server" file may only export
// async functions.
export type AssignmentInput = ServiceAssignmentInput;
export type CategoryAssignment = ServiceCategoryAssignment;
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

export type SpecRelation = ServiceSpecRelation;

export type RelationInput = {
  name: string;
  kind: RuleKind;
  // The attribute the card belongs to, and which side of the rule it takes.
  specUuid: string;
  side: "demand" | "supply";
  // The attribute on the other side. Empty for a conditional rule, whose
  // capacity is its lookup table.
  otherSpecUuid: string;
  comparator: RuleComparator;
  headroomPercent: number;
  severity: RuleSeverity;
  // "conditional" only: the table its limit is read from.
  lookupInputs: string[];
  lookupRows: LookupRow[];
};

// Map a card-authored relation onto the row shape: the card's attribute takes
// whichever side the author picked, the other attribute takes the rest.
const toRuleFields = (input: RelationInput) => ({
  name: input.name,
  description: null,
  kind: input.kind,
  // A conditional rule always measures the card's own attribute against its
  // table, so it takes the demand side and leaves capacity empty.
  consumerSpecUuid:
    input.kind === "conditional" || input.side === "demand"
      ? input.specUuid
      : input.otherSpecUuid || null,
  providerSpecUuid:
    input.kind === "conditional"
      ? null
      : input.side === "demand"
        ? input.otherSpecUuid || null
        : input.specUuid,
  lookup:
    input.kind === "conditional"
      ? { inputs: input.lookupInputs, rows: input.lookupRows }
      : null,
  comparator: input.comparator,
  allocation: "pooled" as const,
  headroomPercent: input.headroomPercent,
  ratioLimit: null,
  condition: null,
  severity: input.severity,
  enabled: true,
});

export const addRelation = async (
  input: RelationInput,
): Promise<SaveAssignmentsResult> => {
  await requireAdmin();
  try {
    await createCompatibilityRule(toRuleFields(input));
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create the relation",
    };
  }
  revalidatePath("/assignments");
  return { success: true };
};

export const removeRelation = async (
  uuid: string,
): Promise<SaveAssignmentsResult> => {
  await requireAdmin();
  try {
    await deleteCompatibilityRule(uuid);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete the relation",
    };
  }
  revalidatePath("/assignments");
  return { success: true };
};
