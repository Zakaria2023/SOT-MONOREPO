import { BrandsReorderTable } from "@/components/brands/brands-reorder-table";
import { BrandsTable } from "@/components/brands/brands-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { ParentFilter } from "@/components/shared/parent-filter";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getBrandChildren, getBrands, getBrandsPage } from "./action";

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

const BrandsBrowseList = async ({ search, page }: BrowseProps) => {
  const result = await getBrandsPage({ search, page });
  return (
    <>
      <BrandsTable brands={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};

const BrandsReorderList = async ({ parent }: ReorderProps) => {
  const children = await getBrandChildren(parent === "root" ? null : parent);
  return <BrandsReorderTable brands={children} />;
};

const BrandsPage = async ({ searchParams }: Props) => {
  const { search, page, parent } = await searchParams;
  const allBrands = await getBrands();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-ink">Brands</h1>

        <Link
          href="/brands/new"
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add Brand
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <ParentFilter items={allBrands} browseLabel="All (browse)" />
        {!parent && <ListSearch placeholder="Search brands..." />}
      </div>

      {parent ? (
        <>
          <p className="text-sm text-muted">
            Drag rows to set their order within this parent. Changes save
            automatically.
          </p>
          <Suspense key={`reorder-${parent}`} fallback={<TableSkeleton />}>
            <BrandsReorderList parent={parent} />
          </Suspense>
        </>
      ) : (
        <Suspense
          key={`${search ?? ""}-${page ?? ""}`}
          fallback={<TableSkeleton />}
        >
          <BrandsBrowseList search={search} page={page} />
        </Suspense>
      )}
    </div>
  );
};

export default BrandsPage;
