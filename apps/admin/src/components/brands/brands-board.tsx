"use client";

import {
  getBrandChildren,
  moveBrandToParent,
  reorderBrandChildren,
} from "@/app/(dashboard)/brands/action";
import type { BrandBoardItem } from "@/app/(dashboard)/brands/action";
import { BrandRowActions } from "@/components/brands/brand-row-actions";
import { ReorderableBoard } from "@/components/shared/reorderable-board";

type BrandsBoardProps = {
  rootItems: BrandBoardItem[];
};

export const BrandsBoard = ({ rootItems }: BrandsBoardProps) => (
  <ReorderableBoard
    rootItems={rootItems}
    loadColumn={getBrandChildren}
    onReorder={reorderBrandChildren}
    onMove={moveBrandToParent}
    renderActions={(brand) => (
      <BrandRowActions uuid={brand.uuid} name={brand.name} />
    )}
  />
);
