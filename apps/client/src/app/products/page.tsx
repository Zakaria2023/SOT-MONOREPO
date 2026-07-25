import { CatalogView } from "@/components/catalog/catalog-view";
import {
  buildTree,
  normalizeSort,
  parseSpecParams,
  subtreeMap,
} from "@/lib/catalog";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import type { Metadata } from "next";
import {
  getBrands,
  getCategories,
  getCategoryFacets,
  getProducts,
  type CategoryFacet,
} from "services";

export const metadata: Metadata = {
  title: "Catalog · SOT Solutions",
  description:
    "Browse the full range of networking, passive infrastructure and security hardware.",
};

type Props = {
  searchParams: Promise<{
    search?: string;
    category?: string;
    brand?: string | string[];
    spec?: string | string[];
    sort?: string;
  }>;
};

const toArray = (value: string | string[] | undefined): string[] => {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const ProductsPage = async ({ searchParams }: Props) => {
  const params = await searchParams;
  const [categories, brands, viewerPricing] = await Promise.all([
    getCategories(),
    getBrands(),
    getViewerPartnerPricing(),
  ]);

  const categoryTree = buildTree(
    categories,
    new Map(categories.map((category) => [category.uuid, category.productCount])),
  );
  const brandTree = buildTree(
    brands,
    new Map(brands.map((brand) => [brand.uuid, brand.productCount])),
  );

  const selectedCategory = params.category ?? null;
  const selectedBrands = toArray(params.brand);
  const sort = normalizeSort(params.sort);
  const search = params.search?.trim() ? params.search.trim() : undefined;

  // Expand a selected category/brand to its whole subtree so choosing a parent
  // includes everything under it.
  const categorySubtrees = subtreeMap(categoryTree);
  const brandSubtrees = subtreeMap(brandTree);
  const categoryUuids = selectedCategory
    ? (categorySubtrees.get(selectedCategory) ?? [selectedCategory])
    : undefined;
  const brandUuids =
    selectedBrands.length > 0
      ? [
          ...new Set(
            selectedBrands.flatMap((uuid) => brandSubtrees.get(uuid) ?? [uuid]),
          ),
        ]
      : undefined;

  // Facets are a property of where the shopper is standing, so they only exist
  // once a category is chosen — an attribute assigned at Networking has nothing
  // to narrow on an all-categories view.
  const selectedSpecs = selectedCategory ? parseSpecParams(params.spec) : {};
  const facets: CategoryFacet[] = selectedCategory
    ? await getCategoryFacets(
        selectedCategory,
        viewerPricing.isPartner ? "partner" : "all",
      )
    : [];

  // Ignore any spec param the current category doesn't actually offer — a
  // stale key left over from a previous category must not silently filter
  // every product away.
  const offeredKeys = new Set(facets.map((facet) => facet.key));
  const specValues = Object.fromEntries(
    Object.entries(selectedSpecs).filter(([key]) => offeredKeys.has(key)),
  );

  const products = await getProducts({
    search,
    categoryUuids,
    brandUuids,
    specValues,
    sort,
  });

  const total = categories.reduce(
    (sum, category) => sum + category.productCount,
    0,
  );

  return (
    <CatalogView
      products={products}
      categoryTree={categoryTree}
      brandTree={brandTree}
      total={total}
      selectedCategory={selectedCategory}
      selectedBrands={selectedBrands}
      facets={facets}
      selectedSpecs={specValues}
      sort={sort}
      search={search ?? ""}
      discountPercent={viewerPricing.discountPercent}
    />
  );
};

export default ProductsPage;
