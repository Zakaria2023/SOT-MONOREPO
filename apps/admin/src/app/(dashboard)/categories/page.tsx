import { CategoriesReorderTable } from "@/components/categories/categories-reorder-table";
import { CategoriesTable } from "@/components/categories/categories-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { ParentFilter } from "@/components/shared/parent-filter";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getCategories, getCategoriesPage, getCategoryChildren } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string; parent?: string }>;
};

const CategoriesPage = async ({ searchParams }: Props) => {
  const { search, page, parent } = await searchParams;
  const allCategories = await getCategories();

  // A `parent` filter switches to reorder mode: show every child of that
  // parent (or the top-level categories for "root"), draggable to set their
  // order within that parent. Otherwise it's the normal searched/paged list.
  const isReorder = Boolean(parent);
  const children = isReorder
    ? await getCategoryChildren(parent === "root" ? null : (parent ?? null))
    : [];
  const result = isReorder ? null : await getCategoriesPage({ search, page });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-ink">Categories</h1>

        <Link
          href="/categories/new"
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add Category
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <ParentFilter items={allCategories} browseLabel="All (browse)" />
        {!isReorder && <ListSearch placeholder="Search categories..." />}
      </div>

      {isReorder ? (
        <>
          <p className="text-sm text-muted">
            Drag rows to set their order within this parent. Changes save
            automatically.
          </p>
          <CategoriesReorderTable categories={children} />
        </>
      ) : (
        result && (
          <>
            <CategoriesTable categories={result.items} />
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              pageSize={result.pageSize}
            />
          </>
        )
      )}
    </div>
  );
};

export default CategoriesPage;
