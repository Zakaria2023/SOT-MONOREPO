"use client";

import { BrandFilter } from "@/components/catalog/brand-filter";
import { Pagination } from "@/components/common/pagination";
import { CatalogProductCard } from "@/components/catalog/catalog-product-card";
import { CategoryFilter } from "@/components/catalog/category-filter";
import { SpecFilter } from "@/components/catalog/spec-filter";
import { SORT_OPTIONS, type TreeNode } from "@/lib/catalog";
import { SPEC_PARAM, encodeSpecParam } from "utils";
import { cn } from "@/lib/utils";
import { LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  BrandListItem,
  CategoryFacet,
  CategoryListItem,
  ProductSummary,
  ProductSort,
} from "services";
import { Dropdown, useDebouncedCallback, useFocusTrap } from "ui";

type CatalogViewProps = {
  products: ProductSummary[];
  categoryTree: TreeNode<CategoryListItem>[];
  brandTree: TreeNode<BrandListItem>[];
  /** Every product in the catalogue, for the "All products" row. */
  total: number;
  /** How many match the current filters, across all pages. */
  matching: number;
  page: number;
  pageSize: number;
  selectedCategory: string | null;
  selectedBrands: string[];
  // Specification facets the selected category offers this viewer. Empty until
  // a category is chosen, since a facet belongs to a place in the tree.
  facets: CategoryFacet[];
  selectedSpecs: Record<string, string[]>;
  sort: ProductSort;
  search: string;
  // The signed-in partner's stacked discount (0 = MSRP for guests/clients).
  discountPercent: number;
};

export const CatalogView = ({
  products,
  categoryTree,
  brandTree,
  total,
  matching,
  page,
  pageSize,
  selectedCategory,
  selectedBrands,
  facets,
  selectedSpecs,
  sort,
  search,
  discountPercent,
}: CatalogViewProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isFiltering, startNavigation] = useTransition();

  const [searchInput, setSearchInput] = useState(search);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const drawerRef = useFocusTrap<HTMLDivElement>(filtersOpen, () =>
    setFiltersOpen(false),
  );

  const selectedBrandSet = new Set(selectedBrands);

  // Read the live URL, apply a mutation, and navigate — the server page then
  // re-runs getProducts with the new params.
  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    mutate(params);
    // Any change to the filters puts the shopper back on page 1. Narrowing from
    // 40 products to 6 while standing on page 3 otherwise lands them on an empty
    // grid that looks like the filter matched nothing.
    params.delete("page");
    const query = params.toString();
    startNavigation(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const setCategory = (uuid: string | null) =>
    updateParams((params) => {
      if (uuid) {
        params.set("category", uuid);
      } else {
        params.delete("category");
      }
      // Facets belong to the category being viewed, so leaving it drops them.
      // Carrying "Cat6" from Copper Cables into IP Cameras would filter the
      // new category down to nothing for no visible reason.
      params.delete(SPEC_PARAM);
    });

  const toggleSpec = (key: string, value: string) =>
    updateParams((params) => {
      const entry = encodeSpecParam(key, value);
      const current = params.getAll(SPEC_PARAM);
      params.delete(SPEC_PARAM);
      const next = current.includes(entry)
        ? current.filter((item) => item !== entry)
        : [...current, entry];
      next.forEach((item) => params.append(SPEC_PARAM, item));
    });

  const toggleBrand = (uuid: string) =>
    updateParams((params) => {
      const current = params.getAll("brand");
      params.delete("brand");
      const next = current.includes(uuid)
        ? current.filter((value) => value !== uuid)
        : [...current, uuid];
      next.forEach((value) => params.append("brand", value));
    });

  const setSort = (value: string) =>
    updateParams((params) => {
      params.set("sort", value);
    });

  const commitSearch = useDebouncedCallback((value: string) => {
    updateParams((params) => {
      const trimmed = value.trim();
      if (trimmed) {
        params.set("search", trimmed);
      } else {
        params.delete("search");
      }
    });
  }, 350);

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    commitSearch(value);
  };

  return (
    <main className="min-h-screen bg-page">
      <div className="mx-auto px-6 py-14 lg:px-12 xl:px-20">
        <header>
          <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
            SOT Solutions · Catalog
          </p>
          <h1 className="font-heading text-accent-gradient mt-3 w-fit text-5xl leading-tight font-bold">
            Everything we deploy, in one place
          </h1>
          <p className="font-grotesk mt-4 max-w-xl text-base leading-relaxed text-muted">
            Browse the full range of networking, passive infrastructure and
            security hardware. Filter by category, brand or search to build your
            deployment.
          </p>
        </header>

        {discountPercent > 0 && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-tint px-4 py-3 text-sm font-semibold text-primary">
            <SlidersHorizontal size={16} />
            Partner pricing active — {discountPercent}% off every product.
          </div>
        )}

        {/* items-start, or the sidebar is stretched to the grid's height by the
            flex default and sticky has nothing left to stick. */}
        <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Desktop sidebar. It sticks below the navbar and scrolls inside
              itself: the filters are taller than the viewport once a category is
              open, and scrolling to reach the specifications used to drag the
              whole product grid off the screen with them. */}
          <aside className="scrollbar-slim hidden shrink-0 flex-col gap-4 lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100vh-7rem)] lg:w-72 lg:overflow-y-auto lg:pr-1 xl:w-80">
            <CategoryFilter
              tree={categoryTree}
              total={total}
              selected={selectedCategory}
              onSelect={setCategory}
            />
            <BrandFilter
              tree={brandTree}
              selected={selectedBrandSet}
              onToggle={toggleBrand}
            />
            <SpecFilter
              facets={facets}
              selected={selectedSpecs}
              onToggle={toggleSpec}
            />
          </aside>

          {/* Mobile filters drawer */}
          {filtersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setFiltersOpen(false)}
              />
              <div
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
                tabIndex={-1}
                className="absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col gap-4 overflow-y-auto bg-page p-4 shadow-2xl outline-none"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-lg text-ink">Filters</span>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    aria-label="Close filters"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <X size={20} />
                  </button>
                </div>
                <CategoryFilter
                  tree={categoryTree}
                  total={total}
                  selected={selectedCategory}
                  onSelect={setCategory}
                />
                <BrandFilter
                  tree={brandTree}
                  selected={selectedBrandSet}
                  onToggle={toggleBrand}
                />
                <SpecFilter
                  facets={facets}
                  selected={selectedSpecs}
                  onToggle={toggleSpec}
                />
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="font-grotesk mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-search-border bg-surface py-3 text-sm font-semibold text-ink transition-colors hover:border-primary lg:hidden"
            >
              <SlidersHorizontal size={16} />
              Filters
            </button>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
                />
                <input
                  value={searchInput}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search products, brands…"
                  className="font-grotesk w-full rounded-xl border border-search-border bg-surface py-3 pr-4 pl-11 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 sm:w-44">
                  <Dropdown
                    value={sort}
                    onChange={setSort}
                    options={SORT_OPTIONS}
                  />
                </div>
                <div className="flex shrink-0 items-center rounded-xl border border-search-border bg-surface p-1">
                  <button
                    type="button"
                    onClick={() => setView("grid")}
                    aria-label="Grid view"
                    aria-pressed={view === "grid"}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      view === "grid"
                        ? "bg-primary-tint text-primary"
                        : "text-faint hover:text-primary",
                    )}
                  >
                    <LayoutGrid size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    aria-label="List view"
                    aria-pressed={view === "list"}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      view === "list"
                        ? "bg-primary-tint text-primary"
                        : "text-faint hover:text-primary",
                    )}
                  >
                    <List size={17} />
                  </button>
                </div>
              </div>
            </div>

            {/* The count is what MATCHES, not what is on this page: "9 products"
                above a grid of nine, on page two of forty, is a lie the shopper
                can see. */}
            <p className="font-grotesk mt-4 text-sm text-muted">
              <span className="font-bold text-ink">{matching}</span>{" "}
              {matching === 1 ? "product" : "products"}
            </p>

            {products.length === 0 ? (
              <p className="font-grotesk mt-6 rounded-2xl border border-hairline bg-surface p-10 text-center text-sm text-faint">
                No products match your filters.
              </p>
            ) : (
              <ul
                className={cn(
                  "mt-5 transition-opacity",
                  view === "grid"
                    ? "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                    : "flex flex-col gap-4",
                  isFiltering && "opacity-60",
                )}
              >
                {products.map((product, index) => (
                  <li key={product.uuid}>
                    <CatalogProductCard
                      product={product}
                      view={view}
                      discountPercent={discountPercent}
                      // Roughly the first grid row at the widest layout. These
                      // are on screen before any scroll, so they preload rather
                      // than waiting to be discovered.
                      priority={index < 3}
                    />
                  </li>
                ))}
              </ul>
            )}

            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(matching / pageSize))}
              total={matching}
              pageSize={pageSize}
              noun="products"
            />
          </div>
        </div>
      </div>
    </main>
  );
};
