export type CompletenessFilters = {
  search?: string;
  category?: string;
  kind?: string;
};

/**
 * The completeness URL with some filters changed and the rest kept.
 *
 * Kept, because a filter that silently drops when another is set makes an author
 * distrust the numbers: narrowing to a category and then to a problem kind must
 * mean both, not the second one alone. Pass an empty string to clear a filter.
 */
export const completenessHref = (
  current: CompletenessFilters,
  change: CompletenessFilters,
): string => {
  const merged = { ...current, ...change };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/completeness?${query}` : "/completeness";
};
