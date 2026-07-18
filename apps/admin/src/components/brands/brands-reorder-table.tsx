"use client";

import { reorderBrands } from "@/app/(dashboard)/brands/action";
import type { BrandListItem } from "@/app/(dashboard)/brands/action";
import { BrandRowActions } from "@/components/brands/brand-row-actions";
import { ReorderableTable } from "@/components/shared/reorderable-table";
import type { ReorderColumn } from "@/components/shared/reorderable-table";
import { ImageOff } from "lucide-react";
import Image from "next/image";
import { documentDownloadUrl } from "@/lib/documents";

type BrandsReorderTableProps = {
  brands: BrandListItem[];
};

const columns: ReorderColumn<BrandListItem>[] = [
  {
    key: "image",
    header: "Image",
    render: (brand) =>
      brand.image ? (
        <Image
          src={documentDownloadUrl(brand.image)}
          alt={brand.name}
          width={40}
          height={40}
          unoptimized
          className="h-10 w-10 rounded-control object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-hover text-faint">
          <ImageOff size={16} />
        </div>
      ),
  },
  {
    key: "name",
    header: "Name",
    render: (brand) => (
      <span className="font-semibold text-ink">{brand.name}</span>
    ),
  },
  {
    key: "parent",
    header: "Parent",
    render: (brand) =>
      brand.parentName ?? <span className="text-faint">—</span>,
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (brand) => <BrandRowActions uuid={brand.uuid} name={brand.name} />,
  },
];

export const BrandsReorderTable = ({ brands }: BrandsReorderTableProps) => (
  <ReorderableTable
    rows={brands}
    columns={columns}
    getId={(brand) => brand.uuid}
    onReorder={reorderBrands}
    emptyMessage="No brands under this parent yet."
  />
);
