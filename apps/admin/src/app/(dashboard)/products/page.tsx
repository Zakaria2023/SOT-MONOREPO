import { ProductsTable } from "@/components/products/products-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncSection } from "@/components/shared/async-section";
import { getProductsPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

type ProductsListProps = {
  search?: string;
  page?: string;
};

const ProductsList = async ({ search, page }: ProductsListProps) => {
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

const ProductsPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        action={{ href: "/products/new", label: "Add Product" }}
      />

      <ListSearch placeholder="Search products..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <ProductsList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default ProductsPage;
