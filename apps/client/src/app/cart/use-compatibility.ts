"use client";

import { useEffect, useMemo, useState } from "react";
import type { RuleEvaluation } from "services";
import { checkCartCompatibility } from "./actions";

type SelectionLine = {
  productUuid: string;
  quantity: number;
};

/**
 * Debounced advisory compatibility check over the current cart lines.
 * Quantities change in quick bursts (+/- steppers), so the check waits for
 * the cart to settle before calling the engine.
 */
export const useCompatibility = (lines: SelectionLine[]) => {
  const [warnings, setWarnings] = useState<RuleEvaluation[]>([]);

  // One entry per product, quantities summed — a product can appear both as
  // a solution line and an individual line.
  const selectionKey = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const line of lines) {
      byProduct.set(
        line.productUuid,
        (byProduct.get(line.productUuid) ?? 0) + line.quantity,
      );
    }
    return [...byProduct.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([productUuid, quantity]) => `${productUuid}:${quantity}`)
      .join(",");
  }, [lines]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectionKey) {
        setWarnings([]);
        return;
      }
      const selection = selectionKey.split(",").map((entry) => {
        const [productUuid, quantity] = entry.split(":");
        return { productUuid, quantity: Number(quantity) };
      });
      void checkCartCompatibility(selection).then((results) => {
        if (active) {
          setWarnings(results);
        }
      });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectionKey]);

  return warnings;
};
