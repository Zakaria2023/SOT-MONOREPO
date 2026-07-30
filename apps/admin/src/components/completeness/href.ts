import { filterHref } from "@/lib/filter-href";

export type CompletenessFilters = {
  search?: string;
  category?: string;
  kind?: string;
};

export const completenessHref = (
  current: CompletenessFilters,
  change: CompletenessFilters,
): string => filterHref("/completeness", current, change);
