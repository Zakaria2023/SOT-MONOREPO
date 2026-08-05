import type { CategoryListItem } from "services";

export type CategoryNode = CategoryListItem & {
  children: CategoryNode[];
};

/**
 * Turns the flat category list into a nested tree.
 *
 * Products used to be threaded through here so the navbar could hand the menu
 * every product in the catalogue. That made a ~500ms read a precondition for
 * rendering ANY page, for a panel most visits never open — the menu now asks for
 * one family's products when that family is opened.
 */
export const buildCategoryTree = (
  categories: CategoryListItem[],
): CategoryNode[] => {
  const presentUuids = new Set(categories.map((category) => category.uuid));
  const childrenByParent = new Map<string | null, CategoryListItem[]>();
  for (const category of categories) {
    // Treat a category whose parent is missing (deleted, dangling
    // parent_uuid) as a root, otherwise it and its subtree never render.
    const parentUuid =
      category.parentUuid && presentUuids.has(category.parentUuid)
        ? category.parentUuid
        : null;
    const siblings = childrenByParent.get(parentUuid) ?? [];
    siblings.push(category);
    childrenByParent.set(parentUuid, siblings);
  }

  const build = (parentUuid: string | null): CategoryNode[] =>
    (childrenByParent.get(parentUuid) ?? []).map((category) => ({
      ...category,
      children: build(category.uuid),
    }));

  return build(null);
};
