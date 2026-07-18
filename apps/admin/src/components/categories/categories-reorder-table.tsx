"use client";

import { reorderCategories } from "@/app/(dashboard)/categories/action";
import type { CategoryListItem } from "@/app/(dashboard)/categories/action";
import { CategoryRowActions } from "@/components/categories/category-row-actions";
import { ReorderableTable } from "@/components/shared/reorderable-table";
import type { ReorderColumn } from "@/components/shared/reorderable-table";
import { ImageOff } from "lucide-react";
import Image from "next/image";
import { documentDownloadUrl } from "@/lib/documents";

type CategoriesReorderTableProps = {
  categories: CategoryListItem[];
};

const columns: ReorderColumn<CategoryListItem>[] = [
  {
    key: "image",
    header: "Image",
    render: (category) =>
      category.image ? (
        <Image
          src={documentDownloadUrl(category.image)}
          alt={category.name}
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
    key: "actions",
    header: "Action",
    align: "right",
    render: (category) => (
      <CategoryRowActions uuid={category.uuid} name={category.name} />
    ),
  },
];

export const CategoriesReorderTable = ({
  categories,
}: CategoriesReorderTableProps) => (
  <ReorderableTable
    rows={categories}
    columns={columns}
    getId={(category) => category.uuid}
    onReorder={reorderCategories}
    emptyMessage="No categories under this parent yet."
  />
);
