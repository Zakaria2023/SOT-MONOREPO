import type { CategoryListItem, ProductListItem } from "services";

export type CategoryNode = CategoryListItem & {
  children: CategoryNode[];
  products: ProductListItem[];
};

/**
 * Turns the flat category + product lists into a nested tree: each node carries
 * its child categories and the products that belong directly to it.
 */
export const buildCategoryTree = (
  categories: CategoryListItem[],
  products: ProductListItem[],
): CategoryNode[] => {
  const childrenByParent = new Map<string | null, CategoryListItem[]>();
  for (const category of categories) {
    const siblings = childrenByParent.get(category.parentUuid) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentUuid, siblings);
  }

  const productsByCategory = new Map<string, ProductListItem[]>();
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
