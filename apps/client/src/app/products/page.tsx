import { CatalogView } from "@/components/catalog/catalog-view";
import { getCachedBrands, getCachedCategories } from "@/lib/data";
import { buildTree, normalizeSort, subtreeMap } from "@/lib/catalog";
import { parseSpecParams, parseSpecRangeParams } from "utils";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import {
  countProducts,
  expandFacetChoices,
  facetSelectionValues,
  getCategoryFacets,
  getProducts,
  type CategoryFacet,
  type ProductFilters,
} from "services";

/** Nine to a page — three rows of three in the grid this page renders. */
const PAGE_SIZE = 9;

// The canonical is the bare /products on purpose. Every facet and sort
// combination renders a reshuffle of the same catalog, and left self-canonical
// they would compete with each other as thousands of near-duplicates.
export const metadata: Metadata = pageMetadata({
  title: "Catalog",
  description:
    "Browse the full range of networking, passive infrastructure and security hardware — filter by category, brand and technical specification.",
  path: "/products",
  keywords: [
    "network switches",
    "wireless access points",
    "structured cabling",
    "racks and enclosures",
    "CCTV cameras",
    "access control",
  ],
});

type Props = {
  searchParams: Promise<{
    search?: string;
    category?: string;
    brand?: string | string[];
    spec?: string | string[];
    range?: string | string[];
    sort?: string;
    page?: string;
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
  // The cached wrappers, not the services directly: the navbar in the layout
  // reads the same two lists on every render, and React's request-scoped cache
  // collapses the pair into one query each. Measured warm, getCategories alone is
  // ~430ms against the shared Aiven pool — paying it twice per page view is the
  // single largest avoidable cost on this screen. This is per-request
  // deduplication, not a data cache: nothing survives the response.
  const [categories, brands, viewerPricing] = await Promise.all([
    getCachedCategories(),
    getCachedBrands(),
    getViewerPartnerPricing(),
  ]);

  const categoryTree = buildTree(
    categories,
    new Map(
      categories.map((category) => [category.uuid, category.productCount]),
    ),
  );
  const brandTree = buildTree(
    brands,
    new Map(brands.map((brand) => [brand.uuid, brand.productCount])),
  );

  const selectedCategory = params.category ?? null;
  const selectedBrands = toArray(params.brand);
  const sort = normalizeSort(params.sort);
  const search = params.search?.trim() ? params.search.trim() : undefined;
  // An out-of-range or junk page reads as page 1 rather than as an empty grid:
  // the URL is user-editable and the shopper did not ask for nothing.
  const page = Math.max(1, Number(params.page) || 1);

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
  // Numeric facets are bounds rather than values, so they travel in their own
  // param — and like the rest, they only mean anything inside a category.
  const selectedRanges = selectedCategory
    ? parseSpecRangeParams(params.range)
    : {};
  // A signed-in partner is a different shopper from a regular user, not a wider
  // one — each sees "everyone" plus their own side.
  const viewer = viewerPricing.isPartner ? "partner" : "user";

  // Resolved twice on purpose. The first pass gives the facets that are always
  // offered; the second re-resolves with what the shopper has actually ticked, so
  // a conditional facet (PoE Budget) appears once its trigger (PoE = Yes) is set.
  const resolveFacets = async (): Promise<CategoryFacet[]> => {
    if (!selectedCategory) {
      return [];
    }
    const baseFacets = await getCategoryFacets(selectedCategory, viewer);
    return getCategoryFacets(
      selectedCategory,
      viewer,
      facetSelectionValues(selectedSpecs, baseFacets),
    );
  };

  const facetsPromise = resolveFacets();

  // The product query only needs the facets when there is a spec choice to
  // expand, and most changes — a category, a brand, the sort — carry none. Made
  // to wait anyway, every one of those clicks paid for a facet resolution before
  // its own round trip could start.
  const asked =
    Object.keys(selectedSpecs).length > 0 ||
    Object.keys(selectedRanges).length > 0;
  const baseFilters: ProductFilters = {
    search,
    categoryUuids,
    brandUuids,
    sort,
    // Trade-only lines stay out of a retail listing. On the filters rather than
    // applied afterwards, so the count under the grid matches the grid.
    viewer,
  };
  const paging = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };

  // The page of rows and the total run together — they share nothing but their
  // filters, and each is a round trip to the database.
  const queryFor = (filters: ProductFilters) =>
    Promise.all([
      getProducts({ ...filters, ...paging }),
      countProducts(filters),
    ]);

  const pageDataPromise = !asked
    ? queryFor(baseFilters)
    : facetsPromise.then((facets) => {
        const offered = (key: string) =>
          facets.some((facet) => facet.key === key);
        return queryFor({
          ...baseFilters,
          // Ignore any spec param the current category doesn't actually offer —
          // a stale key left over from a previous category must not silently
          // filter every product away. An ordered facet is a ceiling, so the
          // choice expands to everything at or below it before querying.
          specValues: expandFacetChoices(
            facets,
            Object.fromEntries(
              Object.entries(selectedSpecs).filter(([key]) => offered(key)),
            ),
          ),
          specRanges: Object.fromEntries(
            Object.entries(selectedRanges).filter(([key]) => offered(key)),
          ),
        });
      });

  const [facets, [products, matching]] = await Promise.all([
    facetsPromise,
    pageDataPromise,
  ]);

  const offeredKeys = new Set(facets.map((facet) => facet.key));
  const chosen = Object.fromEntries(
    Object.entries(selectedSpecs).filter(([key]) => offeredKeys.has(key)),
  );

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
      matching={matching}
      page={page}
      pageSize={PAGE_SIZE}
      selectedCategory={selectedCategory}
      selectedBrands={selectedBrands}
      facets={facets}
      selectedSpecs={chosen}
      selectedRanges={Object.fromEntries(
        Object.entries(selectedRanges).filter(([key]) => offeredKeys.has(key)),
      )}
      sort={sort}
      search={search ?? ""}
      discountPercent={viewerPricing.discountPercent}
    />
  );
};

export default ProductsPage;
