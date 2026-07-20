"use client";

import { reorderBrands } from "@/app/(dashboard)/brands/action";
import type { BrandListItem } from "@/app/(dashboard)/brands/action";
import { BrandRowActions } from "@/components/brands/brand-row-actions";
import { ReorderableBoard } from "@/components/shared/reorderable-board";

type BrandsBoardProps = {
  brands: BrandListItem[];
};

export const BrandsBoard = ({ brands }: BrandsBoardProps) => (
  <ReorderableBoard
    items={brands}
    onReorder={reorderBrands}
    renderActions={(brand) => (
      <BrandRowActions uuid={brand.uuid} name={brand.name} />
    )}
  />
);
