"use client";

import {
  getBrandChildrenPage,
  reorderBrandChildren,
} from "@/app/(dashboard)/brands/action";
import type { BrandBoardColumn } from "@/app/(dashboard)/brands/action";
import { BrandRowActions } from "@/components/brands/brand-row-actions";
import { ReorderableBoard } from "@/components/shared/reorderable-board";

type BrandsBoardProps = {
  columns: BrandBoardColumn[];
  pageSize: number;
};

export const BrandsBoard = ({ columns, pageSize }: BrandsBoardProps) => (
  <ReorderableBoard
    columns={columns}
    pageSize={pageSize}
    fetchPage={getBrandChildrenPage}
    onReorder={reorderBrandChildren}
    renderActions={(brand) => (
      <BrandRowActions uuid={brand.uuid} name={brand.name} />
    )}
  />
);
