"use server";

import {
  getCompatibilityRules,
  getRuleBlueprints,
  type CompatibilityRuleListItem,
  type RuleBlueprintStatus as ServiceRuleBlueprintStatus,
} from "services";
import type { PaginatedResult } from "utils";
import { paginate } from "utils";

export type RuleBlueprintStatus = ServiceRuleBlueprintStatus;

export type RuleListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

// Searched + paginated page of compatibility rules for the list table. The
// frontend drives `search`/`page` through URL search params.
export const getRulesPage = async (
  params: RuleListParams = {},
): Promise<PaginatedResult<CompatibilityRuleListItem>> =>
  paginate(params, ({ limit, offset }) =>
    getCompatibilityRules({ search: params.search, limit, offset }),
  );

// The researched rules, with what each still needs from the library. Reads
// only — installing is a mutation and lives in actions.ts.
export const getBlueprints = async (): Promise<RuleBlueprintStatus[]> =>
  getRuleBlueprints();
