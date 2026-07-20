"use client";

import { reorderCategories } from "@/app/(dashboard)/categories/action";
import type { CategoryListItem } from "@/app/(dashboard)/categories/action";
import { CategoryRowActions } from "@/components/categories/category-row-actions";
import { ReorderableBoard } from "@/components/shared/reorderable-board";

type CategoriesBoardProps = {
  categories: CategoryListItem[];
};

export const CategoriesBoard = ({ categories }: CategoriesBoardProps) => (
  <ReorderableBoard
    items={categories}
    onReorder={reorderCategories}
    renderActions={(category) => (
      <CategoryRowActions uuid={category.uuid} name={category.name} />
    )}
  />
);
