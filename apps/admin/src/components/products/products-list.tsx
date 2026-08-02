import { ProductsTable } from "@/components/products/products-table";
import { Pagination } from "@/components/shared/pagination";
import { getProductsPage } from "services";

type ProductsListProps = {
  // Straight off the URL, so both arrive as text or not at all; getProductsPage
  // decides what a missing or unparseable page means.
  search?: string;
  page?: string;
};

// The part of the products screen that waits on data — what the page's
// AsyncSection suspends around.
export const ProductsList = async ({ search, page }: ProductsListProps) => {
  const result = await getProductsPage({ search, page });

  return (
    <>
      <ProductsTable products={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};
