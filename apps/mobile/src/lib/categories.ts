import { buildTree, findNode, subtreeUuids as nodeSubtree } from "./tree";
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
  const node = findNode(
    buildTree(categories, (category) => category.productCount),
    rootUuid,
  );
  // An uuid that is not in the list still filters by itself: the caller asked for
  // that category, and returning nothing would quietly widen the query to
  // everything instead of narrowing it.
  return node ? nodeSubtree(node) : [rootUuid];
};

/** Top-level categories, in the order the API returned them. */
export const rootCategories = (categories: Category[]): Category[] =>
  categories.filter((category) => !category.parentUuid);
