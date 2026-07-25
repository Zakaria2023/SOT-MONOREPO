"use server";

import {
  getCompatibilityRules,
  type CompatibilityRuleListItem,
} from "services";
import type { PaginatedResult } from "utils";
import { paginate } from "utils";

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
