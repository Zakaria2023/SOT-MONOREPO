"use client";

import {
  getCategoryChildrenPage,
  moveCategoryToParent,
  reorderCategoryChildren,
} from "@/app/(dashboard)/categories/action";
import type { CategoryBoardColumn } from "@/app/(dashboard)/categories/action";
import { CategoryRowActions } from "@/components/categories/category-row-actions";
import { ReorderableBoard } from "@/components/shared/reorderable-board";

type CategoriesBoardProps = {
  columns: CategoryBoardColumn[];
  pageSize: number;
};

export const CategoriesBoard = ({
  columns,
  pageSize,
}: CategoriesBoardProps) => (
  <ReorderableBoard
    columns={columns}
    pageSize={pageSize}
    fetchPage={getCategoryChildrenPage}
    onReorder={reorderCategoryChildren}
    onMove={moveCategoryToParent}
    renderActions={(category) => (
      <CategoryRowActions uuid={category.uuid} name={category.name} />
    )}
  />
);
