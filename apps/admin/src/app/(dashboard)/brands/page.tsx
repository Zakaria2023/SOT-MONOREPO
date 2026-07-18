import { BrandsReorderTable } from "@/components/brands/brands-reorder-table";
import { BrandsTable } from "@/components/brands/brands-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { ParentFilter } from "@/components/shared/parent-filter";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getBrandChildren, getBrands, getBrandsPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string; parent?: string }>;
};

const BrandsPage = async ({ searchParams }: Props) => {
  const { search, page, parent } = await searchParams;
  const allBrands = await getBrands();

  // A `parent` filter switches to reorder mode: show every child of that
  // parent (or the top-level brands for "root"), draggable to set their order
  // within that parent. Otherwise it's the normal searched/paged list.
  const isReorder = Boolean(parent);
  const children = isReorder
    ? await getBrandChildren(parent === "root" ? null : (parent ?? null))
    : [];
  const result = isReorder ? null : await getBrandsPage({ search, page });

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
        {!isReorder && <ListSearch placeholder="Search brands..." />}
      </div>

      {isReorder ? (
        <>
          <p className="text-sm text-muted">
            Drag rows to set their order within this parent. Changes save
            automatically.
          </p>
          <BrandsReorderTable brands={children} />
        </>
      ) : (
        result && (
          <>
            <BrandsTable brands={result.items} />
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

export default BrandsPage;
