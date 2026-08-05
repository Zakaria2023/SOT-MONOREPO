import { ProductCard } from "@/components/products/product-card";
import { Pagination } from "@/components/shared/pagination";
import { getProductsPage } from "services";

type ProductsListProps = {
  // Straight off the URL, so these arrive as text or not at all; getProductsPage
  // decides what a missing or unparseable page means.
  search?: string;
  page?: string;
  categoryUuid?: string;
  brandUuid?: string;
};

/**
 * The part of the products screen that waits on data — what the page's
 * AsyncSection suspends around.
 *
 * Cards rather than a table. The row carried a 40px thumbnail of a product whose
 * photograph is the fastest way to recognise it, and eight columns of which three
 * were usually "—". The card keeps every one of those fields and gives the picture
 * something to be seen at.
 */
export const ProductsList = async ({
  search,
  page,
  categoryUuid,
  brandUuid,
}: ProductsListProps) => {
  const result = await getProductsPage({
    search,
    page,
    categoryUuid,
    brandUuid,
  });

  if (result.items.length === 0) {
    return (
      <p className="rounded-panel border border-hairline bg-surface p-10 text-center text-sm text-faint">
        No products match these filters.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {result.items.map((product) => (
          <ProductCard key={product.uuid} product={product} />
        ))}
      </div>
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};
