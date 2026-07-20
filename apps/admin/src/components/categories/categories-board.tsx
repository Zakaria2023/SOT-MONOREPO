"use client";

import {
  moveCategoryToParent,
  reorderCategoryChildren,
} from "@/app/(dashboard)/categories/action";
import type { CategoryBoardColumn } from "@/app/(dashboard)/categories/action";
import { CategoryRowActions } from "@/components/categories/category-row-actions";
import { ReorderableBoard } from "@/components/shared/reorderable-board";

type CategoriesBoardProps = {
  columns: CategoryBoardColumn[];
};

export const CategoriesBoard = ({ columns }: CategoriesBoardProps) => (
  <ReorderableBoard
    columns={columns}
    onReorder={reorderCategoryChildren}
    onMove={moveCategoryToParent}
    renderActions={(category) => (
      <CategoryRowActions uuid={category.uuid} name={category.name} />
    )}
  />
);
