"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { documentDownloadUrl } from "@/lib/documents";
import { BrandRowActions } from "@/components/brands/brand-row-actions";
import { Table } from "@/components/ui/table";
import type { TableColumn } from "@/components/ui/table";
import type { SelectBrands } from "@/db/schema/brands";

type BrandsTableProps = {
  brands: SelectBrands[];
};

const columns: TableColumn<SelectBrands>[] = [
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
    key: "description",
    header: "Description",
    render: (brand) => (
      <span className="text-muted">{brand.description ?? "—"}</span>
    ),
  },
  {
    key: "order",
    header: "Order",
    align: "right",
    render: (brand) => brand.order,
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (brand) => (
      <BrandRowActions uuid={brand.uuid} name={brand.name} />
    ),
  },
];

export const BrandsTable = ({ brands }: BrandsTableProps) => (
  <Table columns={columns} data={brands} emptyMessage="No brands yet." />
);
