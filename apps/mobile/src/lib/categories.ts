import type { Category } from "./types";

/**
 * A category and everything beneath it.
 *
 * Products sit in leaf categories, so filtering to "Networking" has to match
 * everything under it or the screen comes back empty. The category list
 * already carries parentUuid, so the tree is walked here rather than asking
 * the API for it.
 */
export const subtreeUuids = (
  categories: Category[],
  rootUuid: string,
): string[] => {
  const childrenOf = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentUuid) {
      continue;
    }
    const list = childrenOf.get(category.parentUuid) ?? [];
    list.push(category.uuid);
    childrenOf.set(category.parentUuid, list);
  }

  const collected: string[] = [];
  const seen = new Set<string>();
  const walk = (uuid: string) => {
    // `seen` also guards against a cycle from bad parent data.
    if (seen.has(uuid)) {
      return;
    }
    seen.add(uuid);
    collected.push(uuid);
    for (const child of childrenOf.get(uuid) ?? []) {
      walk(child);
    }
  };
  walk(rootUuid);
  return collected;
};

/** Top-level categories, in the order the API returned them. */
export const rootCategories = (categories: Category[]): Category[] =>
  categories.filter((category) => !category.parentUuid);
