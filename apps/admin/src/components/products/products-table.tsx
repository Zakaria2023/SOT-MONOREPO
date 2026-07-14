"use client";

import type { ProductListItem } from "@/app/(dashboard)/products/action";
import { ProductRowActions } from "@/components/products/product-row-actions";
import type { ProductStatus } from "@/db/enum";
import { PRODUCT_STATUS_LABELS } from "@/db/label";
import { documentDownloadUrl } from "@/lib/documents";
import { ImageOff } from "lucide-react";
import Image from "next/image";
import type { TableColumn } from "ui";
import { Table } from "ui";
import { formatPrice } from "utils";

type ProductsTableProps = {
  products: ProductListItem[];
};

const STATUS_BADGE_CLASSES: Record<ProductStatus, string> = {
  in_stock: "bg-success-tint text-success",
  out_of_stock: "bg-danger-tint text-danger",
  limited_stock: "bg-warning-tint text-warning",
  pre_order: "bg-primary-tint text-primary",
  in_order: "bg-primary-tint text-primary",
  end_of_sale: "bg-hover text-faint",
  end_of_life: "bg-hover text-faint",
};

const columns: TableColumn<ProductListItem>[] = [
  {
    key: "image",
    header: "Image",
    render: (product) =>
      product.image ? (
        <Image
          src={documentDownloadUrl(product.image)}
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
    render: (product) =>
      product.price ? (
        formatPrice(product.price, product.currency)
      ) : (
        <span className="text-faint">Set by partner</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    render: (product) => {
      const status = product.status ?? "in_stock";
      return (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[status]}`}
        >
          {PRODUCT_STATUS_LABELS[status]}
        </span>
      );
    },
  },
  {
    key: "order",
    header: "Order",
    align: "right",
    render: (product) => product.order,
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (product) => (
      <ProductRowActions uuid={product.uuid} name={product.name} />
    ),
  },
];

export const ProductsTable = ({ products }: ProductsTableProps) => (
  <Table columns={columns} data={products} emptyMessage="No products yet." />
);
