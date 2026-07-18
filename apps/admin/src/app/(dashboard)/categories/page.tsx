import { CategoriesReorderTable } from "@/components/categories/categories-reorder-table";
import { CategoriesTable } from "@/components/categories/categories-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { ParentFilter } from "@/components/shared/parent-filter";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getCategories, getCategoriesPage, getCategoryChildren } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string; parent?: string }>;
};

type BrowseProps = {
  search?: string;
  page?: string;
};

type ReorderProps = {
  parent: string;
};

const CategoriesBrowseList = async ({ search, page }: BrowseProps) => {
  const result = await getCategoriesPage({ search, page });
  return (
    <>
      <CategoriesTable categories={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};

const CategoriesReorderList = async ({ parent }: ReorderProps) => {
  const children = await getCategoryChildren(parent === "root" ? null : parent);
  return <CategoriesReorderTable categories={children} />;
};

const CategoriesPage = async ({ searchParams }: Props) => {
  const { search, page, parent } = await searchParams;
  const allCategories = await getCategories();

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
        {!parent && <ListSearch placeholder="Search categories..." />}
      </div>

      {parent ? (
        <>
          <p className="text-sm text-muted">
            Drag rows to set their order within this parent. Changes save
            automatically.
          </p>
          <Suspense key={`reorder-${parent}`} fallback={<TableSkeleton />}>
            <CategoriesReorderList parent={parent} />
          </Suspense>
        </>
      ) : (
        <Suspense
          key={`${search ?? ""}-${page ?? ""}`}
          fallback={<TableSkeleton />}
        >
          <CategoriesBrowseList search={search} page={page} />
        </Suspense>
      )}
    </div>
  );
};

export default CategoriesPage;
