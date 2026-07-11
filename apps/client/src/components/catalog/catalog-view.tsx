"use client";

import { addProductToCart } from "@/app/actions";
import { BrandFilter } from "@/components/catalog/brand-filter";
import { CatalogProductCard } from "@/components/catalog/catalog-product-card";
import { CategoryFilter } from "@/components/catalog/category-filter";
import { SORT_OPTIONS, type TreeNode } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Check, LayoutGrid, List, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  BrandListItem,
  CategoryListItem,
  ProductListItem,
  ProductSort,
} from "services";
import { Dropdown } from "ui";

type CatalogViewProps = {
  products: ProductListItem[];
  categoryTree: TreeNode<CategoryListItem>[];
  brandTree: TreeNode<BrandListItem>[];
  total: number;
  selectedCategory: string | null;
  selectedBrands: string[];
  sort: ProductSort;
  search: string;
};

type Toast = {
  text: string;
  error: boolean;
  key: number;
};

export const CatalogView = ({
  products,
  categoryTree,
  brandTree,
  total,
  selectedCategory,
  selectedBrands,
  sort,
  search,
}: CatalogViewProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isFiltering, startNavigation] = useTransition();

  const [searchInput, setSearchInput] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [addingUuid, setAddingUuid] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [, startAdd] = useTransition();

  const selectedBrandSet = useMemo(
    () => new Set(selectedBrands),
    [selectedBrands],
  );

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // Read the live URL, apply a mutation, and navigate — the server page then
  // re-runs getProducts with the new params.
  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    mutate(params);
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

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    searchTimer.current = setTimeout(() => {
      updateParams((params) => {
        const trimmed = value.trim();
        if (trimmed) {
          params.set("search", trimmed);
        } else {
          params.delete("search");
        }
      });
    }, 350);
  };

  const onAdd = (product: ProductListItem) => {
    setAddingUuid(product.uuid);
    startAdd(async () => {
      const result = await addProductToCart(product.uuid);
      setAddingUuid(null);
      setToast({
        text: result.error ?? `Added ${product.name} to your cart`,
        error: Boolean(result.error),
        key: Date.now(),
      });
    });
  };

  return (
    <main className="min-h-screen bg-[#F8F7FB]">
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
        <header>
          <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
            SOT Solutions · Catalog
          </p>
          <h1 className="font-heading mt-3 text-5xl leading-tight font-bold text-ink">
            Everything we deploy, in one place
          </h1>
          <p className="font-grotesk mt-4 max-w-xl text-base leading-relaxed text-[#62656B]">
            Browse the full range of networking, passive infrastructure and
            security hardware. Filter by category, brand or search to build your
            deployment.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-8 lg:flex-row">
          <aside className="flex shrink-0 flex-col gap-4 lg:w-64">
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
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#8A8F98]"
                />
                <input
                  value={searchInput}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search products, brands…"
                  className="font-grotesk w-full rounded-xl border border-[#E3E4E9] bg-white py-3 pr-4 pl-11 text-sm text-ink outline-none transition-colors placeholder:text-[#8A8F98] focus:border-primary"
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
                <div className="flex shrink-0 items-center rounded-xl border border-[#E3E4E9] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setView("grid")}
                    aria-label="Grid view"
                    aria-pressed={view === "grid"}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      view === "grid"
                        ? "bg-primary-tint text-primary"
                        : "text-[#8A8F98] hover:text-primary",
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
                        : "text-[#8A8F98] hover:text-primary",
                    )}
                  >
                    <List size={17} />
                  </button>
                </div>
              </div>
            </div>

            <p className="font-grotesk mt-4 text-sm text-[#62656B]">
              <span className="font-bold text-ink">{products.length}</span>{" "}
              {products.length === 1 ? "product" : "products"}
            </p>

            {products.length === 0 ? (
              <p className="font-grotesk mt-6 rounded-2xl border border-hairline bg-white p-10 text-center text-sm text-[#8A8F98]">
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
                {products.map((product) => (
                  <li key={product.uuid}>
                    <CatalogProductCard
                      product={product}
                      adding={addingUuid === product.uuid}
                      view={view}
                      onAdd={() => onAdd(product)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          className={cn(
            "font-grotesk fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg",
            toast.error ? "bg-red-500" : "bg-ink",
          )}
        >
          {!toast.error && <Check size={16} className="text-green-400" />}
          {toast.text}
        </div>
      )}
    </main>
  );
};
