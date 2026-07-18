import { ProductsTable } from "@/components/products/products-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getProductsPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const ProductsPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;
  const result = await getProductsPage({ search, page });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-ink">Products</h1>

        <Link
          href="/products/new"
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add Product
        </Link>
      </div>

      <ListSearch placeholder="Search products..." />

      <ProductsTable products={result.items} />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </div>
  );
};

export default ProductsPage;
