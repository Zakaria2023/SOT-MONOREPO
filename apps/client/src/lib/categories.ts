import type { CategoryListItem, ProductSummary } from "services";

export type CategoryNode = CategoryListItem & {
  children: CategoryNode[];
  products: ProductSummary[];
};

/**
 * Turns the flat category + product lists into a nested tree: each node carries
 * its child categories and the products that belong directly to it.
 */
export const buildCategoryTree = (
  categories: CategoryListItem[],
  products: ProductSummary[],
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

  const productsByCategory = new Map<string, ProductSummary[]>();
  for (const product of products) {
    const list = productsByCategory.get(product.categoryUuid) ?? [];
    list.push(product);
    productsByCategory.set(product.categoryUuid, list);
  }

  const build = (parentUuid: string | null): CategoryNode[] =>
    (childrenByParent.get(parentUuid) ?? []).map((category) => ({
      ...category,
      children: build(category.uuid),
      products: productsByCategory.get(category.uuid) ?? [],
    }));

  return build(null);
};
