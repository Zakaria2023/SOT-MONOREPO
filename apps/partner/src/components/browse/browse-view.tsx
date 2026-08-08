"use client";

import {
  addToBasketAction,
  browseAction,
  type BrowseResult,
} from "@/app/(dashboard)/browse/actions";
import { Check, Plus, Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { formatMoney } from "utils";

// P4 — browse, filter, add.
//
// The filtering is LIVE: a facet tick re-queries rather than waiting for a
// submit, because the whole point of a facet is seeing the catalogue shrink as
// you narrow it. Debounced on the search box only, where every keystroke would
// otherwise be a round trip.
//
// The facets themselves come back from the server on every query, not just the
// products, because which facets EXIST depends on what is ticked — a conditional
// attribute like PoE Budget only appears once PoE is set to yes. Re-rendering
// the same filter list would hide the one that just became relevant.

type BrowseViewProps = {
  initial: BrowseResult;
};

export const BrowseView = ({ initial }: BrowseViewProps) => {
  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState("");
  const [categoryUuid, setCategoryUuid] = useState<string>();
  const [specs, setSpecs] = useState<Record<string, string[]>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  // One effect, keyed on everything that changes the query. The search box is
  // debounced inside it; a facet tick is not, because it is a deliberate act and
  // waiting 250ms after a click reads as lag.
  useEffect(() => {
    const run = () => {
      browseAction({ search: search.trim() || undefined, categoryUuid, specs })
        .then(setResult)
        .catch(() => undefined);
    };
    const timer = search === "" ? undefined : setTimeout(run, 250);
    if (timer === undefined) {
      run();
      return;
    }
    return () => clearTimeout(timer);
  }, [search, categoryUuid, specs]);

  const toggleSpec = (key: string, value: string): void => {
    setSpecs((current) => {
      const chosen = current[key] ?? [];
      const next = chosen.includes(value)
        ? chosen.filter((entry) => entry !== value)
        : [...chosen, value];
      const updated = { ...current, [key]: next };
      if (next.length === 0) {
        delete updated[key];
      }
      return updated;
    });
  };

  const add = (productUuid: string): void => {
    startTransition(async () => {
      const outcome = await addToBasketAction(productUuid, 1);
      if (!outcome.error) {
        setAdded((current) => ({ ...current, [productUuid]: true }));
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <aside className="flex flex-col gap-4">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the catalogue…"
            className="w-full rounded-control border border-hairline bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">
            Category
          </span>
          <button
            type="button"
            onClick={() => {
              setCategoryUuid(undefined);
              // Facets belong to a category, so leaving one has to drop what was
              // ticked inside it. Keeping them would filter the next category by
              // attributes it does not carry, and quietly return nothing.
              setSpecs({});
            }}
            className={`rounded-control px-2 py-1.5 text-left text-xs ${
              categoryUuid === undefined
                ? "bg-primary font-medium text-white"
                : "text-secondary hover:bg-hover"
            }`}
          >
            Everything
          </button>
          {result.categories.map((category) => (
            <button
              key={category.uuid}
              type="button"
              onClick={() => {
                setCategoryUuid(category.uuid);
                setSpecs({});
              }}
              className={`rounded-control px-2 py-1.5 text-left text-xs ${
                categoryUuid === category.uuid
                  ? "bg-primary font-medium text-white"
                  : "text-secondary hover:bg-hover"
              }`}
            >
              {category.path ? `${category.path} · ` : ""}
              {category.name}
            </button>
          ))}
        </div>

        {result.facets.map((facet) => (
          <div key={facet.key} className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">
              {facet.label}
            </span>
            {facet.options.map((option) => {
              const ticked = (specs[facet.key] ?? []).includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleSpec(facet.key, option.value)}
                  className="flex items-center gap-2 rounded-control px-2 py-1 text-left text-xs text-secondary hover:bg-hover"
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
                      ticked
                        ? "border-primary bg-primary text-white"
                        : "border-hairline"
                    }`}
                  >
                    {ticked && <Check size={10} />}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          {result.products.length} product
          {result.products.length === 1 ? "" : "s"}
          {result.discountPercent > 0 &&
            ` · your discount is ${result.discountPercent}%, applied once at the basket`}
        </p>

        {result.products.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline px-4 py-10 text-center text-xs text-faint">
            Nothing matches. Loosen a filter.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.products.map((product) => (
              <div
                key={product.uuid}
                className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-4"
              >
                <p className="text-sm line-clamp-2">{product.name}</p>
                <p className="text-[11px] text-muted">
                  {product.brandName ?? "—"} · {product.categoryName ?? "—"}
                </p>
                <p className="mt-auto text-sm">
                  {/* MSRP only. The discount is one lump sum at the basket — a
                      per-line partner price is the buy-in price. */}
                  {product.price
                    ? formatMoney(Number(product.price), product.currency ?? "SAR")
                    : "No price yet"}
                </p>
                <button
                  type="button"
                  onClick={() => add(product.uuid)}
                  disabled={pending}
                  className="flex items-center justify-center gap-1.5 rounded-control border border-hairline px-3 py-2 text-xs hover:bg-hover disabled:opacity-60"
                >
                  {added[product.uuid] ? (
                    <>
                      <Check size={13} />
                      In your basket
                    </>
                  ) : (
                    <>
                      <Plus size={13} />
                      Add
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
