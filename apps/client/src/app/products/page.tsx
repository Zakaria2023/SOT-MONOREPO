import { CatalogView } from "@/components/catalog/catalog-view";
import { buildTree, normalizeSort, subtreeMap } from "@/lib/catalog";
import type { Metadata } from "next";
import { getBrands, getCategories, getProducts } from "services";

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
  const [categories, brands] = await Promise.all([
    getCategories(),
    getBrands(),
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

  const products = await getProducts({
    search,
    categoryUuids,
    brandUuids,
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
      sort={sort}
      search={search ?? ""}
    />
  );
};

export default ProductsPage;
