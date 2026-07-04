"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { CategoryRowActions } from "@/components/categories/category-row-actions";
import { Table } from "@/components/ui/table";
import type { TableColumn } from "@/components/ui/table";
import type { CategoryListItem } from "@/app/(dashboard)/categories/action";

type CategoriesTableProps = {
  categories: CategoryListItem[];
};

const columns: TableColumn<CategoryListItem>[] = [
  {
    key: "image",
    header: "Image",
    render: (category) =>
      category.image ? (
        <Image
          src={`/api/documents/${category.image}/download`}
          alt={category.name}
          width={40}
          height={40}
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
    render: (category) => (
      <span className="font-semibold text-ink">{category.name}</span>
    ),
  },
  {
    key: "parent",
    header: "Parent",
    render: (category) =>
      category.parentName ?? <span className="text-faint">—</span>,
  },
  {
    key: "description",
    header: "Description",
    render: (category) => (
      <span className="text-muted">{category.description ?? "—"}</span>
    ),
  },
  {
    key: "order",
    header: "Order",
    align: "right",
    render: (category) => category.order,
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (category) => (
      <CategoryRowActions uuid={category.uuid} name={category.name} />
    ),
  },
];

export const CategoriesTable = ({ categories }: CategoriesTableProps) => (
  <Table
    columns={columns}
    data={categories}
    emptyMessage="No categories yet."
  />
);
