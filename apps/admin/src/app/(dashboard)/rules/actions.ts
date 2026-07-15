"use server";

import type { RuleComparator, RuleKind, RuleSeverity } from "@/db/enum";
import {
  checkCompatibility,
  createCompatibilityRule,
  deleteCompatibilityRule,
  updateCompatibilityRule,
} from "services";
import type { CompatibilityReport, SelectionInput } from "services";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type RuleActionInput = {
  name: string;
  description: string;
  kind: RuleKind;
  consumerSpecUuid: string;
  providerSpecUuid: string;
  comparator: RuleComparator;
  headroomPercent: number;
  conditionSpecKey: string;
  conditionValue: string;
  severity: RuleSeverity;
  enabled: boolean;
};

export type RuleActionResult = {
  error?: string;
  success?: boolean;
};

export type CheckCompatibilityResult = {
  report?: CompatibilityReport;
  error?: string;
};

// Normalize the form's flat fields to the rule row shape.
const toFields = (input: RuleActionInput) => ({
  name: input.name,
  description: input.description.trim() || null,
  kind: input.kind,
  consumerSpecUuid: input.consumerSpecUuid,
  providerSpecUuid: input.providerSpecUuid,
  comparator: input.comparator,
  headroomPercent: input.headroomPercent,
  condition:
    input.conditionSpecKey && input.conditionValue
      ? { specKey: input.conditionSpecKey, values: [input.conditionValue] }
      : null,
  severity: input.severity,
  enabled: input.enabled,
});

export const createRuleAction = async (
  _prevState: RuleActionResult,
  input: RuleActionInput,
): Promise<RuleActionResult> => {
  try {
    await createCompatibilityRule(toFields(input));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create rule",
    };
  }

  revalidatePath("/rules");
  redirect("/rules");
};

export const updateRuleAction = async (
  uuid: string,
  _prevState: RuleActionResult,
  input: RuleActionInput,
): Promise<RuleActionResult> => {
  try {
    await updateCompatibilityRule(uuid, toFields(input));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update rule",
    };
  }

  revalidatePath("/rules");
  redirect("/rules");
};

export const deleteRuleAction = async (
  uuid: string,
): Promise<RuleActionResult> => {
  try {
    await deleteCompatibilityRule(uuid);
    revalidatePath("/rules");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete rule",
    };
  }
};

export const checkCompatibilityAction = async (
  selection: SelectionInput[],
): Promise<CheckCompatibilityResult> => {
  try {
    return { report: await checkCompatibility(selection) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to check compatibility",
    };
  }
};
