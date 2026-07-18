import { CategoriesTable } from "@/components/categories/categories-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getCategoriesPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const CategoriesPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;
  const result = await getCategoriesPage({ search, page });

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

      <ListSearch placeholder="Search categories..." />

      <CategoriesTable categories={result.items} />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </div>
  );
};

export default CategoriesPage;
