"use client";

import type { ProductPickerItem } from "services";
import { Minus, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { Input, useDebouncedCallback } from "ui";

// ---------------------------------------------------------------------------
// A basket somebody assembles by hand, to point a check at.
//
// Extracted from the single-rule preview when the sandbox needed the same thing:
// search, add, change the quantity, drop the line. Two copies of a picker whose
// whole job is producing the input to an evaluator is how the two screens end up
// disagreeing about what a selection IS — one summing duplicate lines, the other
// passing them through — and the evaluator would be the last to know.
// ---------------------------------------------------------------------------

export type BasketLine = {
  productUuid: string;
  name: string;
  quantity: number;
};

type BasketBuilderProps = {
  lines: BasketLine[];
  onChange: (lines: BasketLine[]) => void;
  // Passed in rather than imported, so each screen keeps its own route-folder
  // action and this component stays free of a server dependency.
  search: (term: string) => Promise<ProductPickerItem[]>;
  emptyHint: string;
};

export const BasketBuilder = ({
  lines,
  onChange,
  search,
  emptyHint,
}: BasketBuilderProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductPickerItem[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = useDebouncedCallback(async (term: string) => {
    setSearching(true);
    try {
      setResults(await search(term));
    } finally {
      setSearching(false);
    }
  }, 250);

  const changeQuery = (term: string): void => {
    setQuery(term);
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    runSearch(term);
  };

  const addLine = (product: ProductPickerItem): void => {
    // Adding the same product twice is a quantity change, not a second line —
    // the evaluator sums them anyway, so two lines would only be confusing.
    onChange(
      lines.some((line) => line.productUuid === product.uuid)
        ? lines.map((line) =>
            line.productUuid === product.uuid
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [
            ...lines,
            { productUuid: product.uuid, name: product.name, quantity: 1 },
          ],
    );
    setQuery("");
    setResults([]);
  };

  const setQuantity = (productUuid: string, quantity: number): void => {
    onChange(
      quantity <= 0
        ? lines.filter((line) => line.productUuid !== productUuid)
        : lines.map((line) =>
            line.productUuid === productUuid ? { ...line, quantity } : line,
          ),
    );
  };

  return (
    <>
      <Input
        icon={<Search size={15} />}
        placeholder="Search products by name, SKU, or model…"
        value={query}
        onChange={(event) => changeQuery(event.target.value)}
      />

      {query.trim().length >= 2 && (
        <div className="flex flex-col gap-1">
          {searching && <p className="text-[11px] text-faint">Searching…</p>}
          {!searching && results.length === 0 && (
            <p className="text-[11px] text-faint">Nothing matched.</p>
          )}
          {results.map((product) => (
            <button
              key={product.uuid}
              type="button"
              onClick={() => addLine(product)}
              className="flex items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs text-ink hover:bg-hover"
            >
              <Plus size={12} className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1 line-clamp-1">{product.name}</span>
              {product.categoryName && (
                <span className="shrink-0 text-[11px] text-faint">
                  {product.categoryName}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {lines.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline px-3 py-6 text-center text-[11px] text-faint">
          {emptyHint}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lines.map((line) => (
            <div
              key={line.productUuid}
              className="flex items-center gap-2 rounded-control border border-hairline bg-base px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 text-xs text-ink line-clamp-1">
                {line.name}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(line.productUuid, line.quantity - 1)
                  }
                  aria-label={`One fewer ${line.name}`}
                  className="rounded-control p-1 text-faint hover:bg-hover hover:text-ink"
                >
                  <Minus size={12} />
                </button>
                <span className="w-8 text-center text-xs font-medium text-ink">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(line.productUuid, line.quantity + 1)
                  }
                  aria-label={`One more ${line.name}`}
                  className="rounded-control p-1 text-faint hover:bg-hover hover:text-ink"
                >
                  <Plus size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity(line.productUuid, 0)}
                  aria-label={`Remove ${line.name}`}
                  className="rounded-control p-1 text-faint hover:bg-hover hover:text-red-400"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
