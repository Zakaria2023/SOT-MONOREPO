import { ProductsList } from "@/components/products/products-list";
import { AsyncSection } from "@/components/shared/async-section";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
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
