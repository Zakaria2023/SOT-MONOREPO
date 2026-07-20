"use client";

import {
  moveBrandToParent,
  reorderBrandChildren,
} from "@/app/(dashboard)/brands/action";
import type { BrandBoardColumn } from "@/app/(dashboard)/brands/action";
import { BrandRowActions } from "@/components/brands/brand-row-actions";
import { ReorderableBoard } from "@/components/shared/reorderable-board";

type BrandsBoardProps = {
  columns: BrandBoardColumn[];
};

export const BrandsBoard = ({ columns }: BrandsBoardProps) => (
  <ReorderableBoard
    columns={columns}
    onReorder={reorderBrandChildren}
    onMove={moveBrandToParent}
    renderActions={(brand) => (
      <BrandRowActions uuid={brand.uuid} name={brand.name} />
    )}
  />
);
