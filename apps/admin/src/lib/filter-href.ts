export type FilterParams = Record<string, string | undefined>;

/**
 * The current URL with some filters changed and the rest kept.
 *
 * Kept, because a filter that silently drops when another is set makes an author
 * distrust the numbers: narrowing to a category and then to a problem kind must
 * mean both, not the second one alone. Pass an empty string to clear one.
 */
export const filterHref = (
  path: string,
  current: FilterParams,
  change: FilterParams,
): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...change })) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};
