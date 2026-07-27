import type { SelectCategories } from "@/db/schema/categories";
import type { DropdownOption } from "ui";

/**
 * Flattens the category tree into depth-ordered dropdown options, so a
 * `Dropdown` renders the hierarchy with indentation.
 *
 * A category whose parent is missing (deleted, dangling parent_uuid) is
 * treated as a root, otherwise it and its subtree would never render.
 *
 * Tolerates a missing list rather than throwing. The types say it cannot happen,
 * and across a server/client boundary that is not quite true: a stale bundle for
 * one component and fresh source for another is enough to hand this `undefined`,
 * and an empty picker is a far better outcome than a blank page.
 */
export const buildCategoryTreeOptions = (
  categories: SelectCategories[] | null | undefined,
): DropdownOption[] => {
  if (!Array.isArray(categories) || categories.length === 0) {
    return [];
  }
  const presentUuids = new Set(categories.map((category) => category.uuid));
  const childrenByParent = new Map<string | null, SelectCategories[]>();
  for (const category of categories) {
    const parentUuid =
      category.parentUuid && presentUuids.has(category.parentUuid)
        ? category.parentUuid
        : null;
    const siblings = childrenByParent.get(parentUuid) ?? [];
    siblings.push(category);
    childrenByParent.set(parentUuid, siblings);
  }

  const options: DropdownOption[] = [];
  const walk = (parentUuid: string | null, depth: number) => {
    for (const category of childrenByParent.get(parentUuid) ?? []) {
      options.push({ value: category.uuid, label: category.name, depth });
      walk(category.uuid, depth + 1);
    }
  };
  walk(null, 0);
  return options;
};

/**
 * The category itself plus every ancestor, walking up the parent chain. An
 * attribute assigned to any of these applies to the given category.
 */
export const categoryWithAncestors = (
  categoryUuid: string,
  categories: SelectCategories[],
): string[] => {
  const parentOf = new Map(
    categories.map((category) => [category.uuid, category.parentUuid]),
  );
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = categoryUuid;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = parentOf.get(current) ?? null;
  }
  return chain;
};
