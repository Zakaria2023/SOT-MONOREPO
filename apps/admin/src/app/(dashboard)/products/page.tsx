import { ProductsFilters } from "@/components/products/products-filters";
import { ProductsList } from "@/components/products/products-list";
import { AsyncSection } from "@/components/shared/async-section";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";
import { getBrands, getCategories } from "services";

type Props = {
  searchParams: Promise<{
    search?: string;
    page?: string;
    category?: string;
    brand?: string;
  }>;
};

const ProductsPage = async ({ searchParams }: Props) => {
  const { search, page, category, brand } = await searchParams;
  // The filter options are the chrome, so they load with the page rather than
  // inside the boundary — the list is what a filter change re-suspends.
  const [categories, brands] = await Promise.all([
    getCategories(),
    getBrands(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        action={{ href: "/products/new", label: "Add Product" }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <ListSearch placeholder="Search products..." />
        <ProductsFilters categories={categories} brands={brands} />
      </div>

      <AsyncSection
        reloadKey={`${search ?? ""}-${page ?? ""}-${category ?? ""}-${brand ?? ""}`}
      >
        <ProductsList
          search={search}
          page={page}
          categoryUuid={category}
          brandUuid={brand}
        />
      </AsyncSection>
    </div>
  );
};

export default ProductsPage;
