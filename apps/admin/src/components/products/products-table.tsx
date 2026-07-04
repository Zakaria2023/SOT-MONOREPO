"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { Table } from "@/components/ui/table";
import type { TableColumn } from "@/components/ui/table";
import { PRODUCT_STATUS_LABELS } from "@/lib/label";
import type { ProductListItem } from "@/app/(dashboard)/products/action";

type ProductsTableProps = {
  products: ProductListItem[];
};

const STATUS_BADGE_CLASSES: Record<ProductListItem["status"], string> = {
  draft: "bg-warning-tint text-warning",
  published: "bg-success-tint text-success",
  archived: "bg-hover text-faint",
};

const columns: TableColumn<ProductListItem>[] = [
  {
    key: "image",
    header: "Image",
    render: (product) =>
      product.image ? (
        <Image
          src={`/api/documents/${product.image}/download`}
          alt={product.name}
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
    render: (product) => (
      <span className="font-semibold text-ink">{product.name}</span>
    ),
  },
  {
    key: "category",
    header: "Category",
    render: (product) =>
      product.categoryName ?? <span className="text-faint">—</span>,
  },
  {
    key: "brand",
    header: "Brand",
    render: (product) =>
      product.brandName ?? <span className="text-faint">—</span>,
  },
  {
    key: "price",
    header: "Price",
    align: "right",
    render: (product) => `${product.price} ${product.currency}`,
  },
  {
    key: "status",
    header: "Status",
    render: (product) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[product.status]}`}
      >
        {PRODUCT_STATUS_LABELS[product.status]}
      </span>
    ),
  },
  {
    key: "order",
    header: "Order",
    align: "right",
    render: (product) => product.order,
  },
];

export const ProductsTable = ({ products }: ProductsTableProps) => (
  <Table columns={columns} data={products} emptyMessage="No products yet." />
);
