"use client";

import {
  getCategoryChildren,
  moveCategoryToParent,
  reorderCategoryChildren,
} from "@/app/(dashboard)/categories/action";
import type { CategoryBoardItem } from "@/app/(dashboard)/categories/action";
import { CategoryRowActions } from "@/components/categories/category-row-actions";
import { ReorderableBoard } from "@/components/shared/reorderable-board";

type CategoriesBoardProps = {
  rootItems: CategoryBoardItem[];
};

export const CategoriesBoard = ({ rootItems }: CategoriesBoardProps) => (
  <ReorderableBoard
    rootItems={rootItems}
    loadColumn={getCategoryChildren}
    onReorder={reorderCategoryChildren}
    onMove={moveCategoryToParent}
    renderActions={(category) => (
      <CategoryRowActions uuid={category.uuid} name={category.name} />
    )}
  />
);
