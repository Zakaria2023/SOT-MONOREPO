"use client";

import { addSolutionToCart } from "@/app/categories/[uuid]/actions";
import { CatalogProductCard } from "@/components/catalog/catalog-product-card";
import { Check, ShoppingCart } from "lucide-react";
import { useState, useTransition } from "react";
import type { ProductListItem, SelectCategories } from "services";

type CategorySolutionProps = {
  category: SelectCategories;
  products: ProductListItem[];
  canAdd: boolean;
  discountPercent?: number;
};

export const CategorySolution = ({
  category,
  products,
  canAdd,
  discountPercent = 0,
}: CategorySolutionProps) => {
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const onAddAll = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await addSolutionToCart(category.uuid);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    });

  return (
    <main className="min-h-screen bg-page">
      <div className="mx-auto px-6 py-14 lg:px-12 xl:px-20">
        <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
          Shop by solution
        </p>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl leading-tight text-ink">
              {category.name}
            </h1>
            {category.description && (
              <p className="font-grotesk mt-2 max-w-xl text-base leading-relaxed text-muted">
                {category.description}
              </p>
            )}
            <p className="font-grotesk mt-2 text-sm text-faint">
              {products.length}{" "}
              {products.length === 1 ? "product" : "products"} in this solution
            </p>
          </div>

          {canAdd && products.length > 0 && (
            <button
              type="button"
              onClick={onAddAll}
              disabled={isPending}
              className="font-grotesk inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {added ? <Check size={17} /> : <ShoppingCart size={17} />}
              {added
                ? "Added to cart"
                : isPending
                  ? "Adding…"
                  : "Add all to cart"}
            </button>
          )}
        </div>

        {error && (
          <p className="font-grotesk mt-3 text-sm text-red-500">{error}</p>
        )}

        {products.length === 0 ? (
          <p className="font-grotesk mt-10 rounded-2xl border border-hairline bg-surface p-10 text-center text-sm text-faint">
            This solution has no products yet.
          </p>
        ) : (
          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <li key={product.uuid}>
                <CatalogProductCard
                product={product}
                view="grid"
                discountPercent={discountPercent}
              />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};
