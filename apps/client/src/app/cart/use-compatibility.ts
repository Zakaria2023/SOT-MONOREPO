"use client";

import { useEffect, useMemo, useState } from "react";
import { checkCartDesign, type DesignFinding } from "./actions";

type SelectionLine = {
  productUuid: string;
  quantity: number;
};

type DesignState = {
  blockers: DesignFinding[];
  warnings: DesignFinding[];
  // Checks that could not run. The service has always returned these and the
  // state was already carrying them at runtime — the type just did not say so,
  // so no caller could reach them and the buyer never saw one.
  unknowns: DesignFinding[];
};

const EMPTY: DesignState = { blockers: [], warnings: [], unknowns: [] };

/**
 * Debounced design check over the current cart lines — requires-companion
 * (Presence) plus compatibility rules. Quantities change in quick bursts
 * (+/- steppers), so it waits for the cart to settle before calling the engine.
 * Returns blockers (must fix), warnings (advisory), and the checks that could
 * not be run at all — the last of which must never be mistaken for a pass.
 */
export const useCompatibility = (lines: SelectionLine[]): DesignState => {
  const [state, setState] = useState<DesignState>(EMPTY);

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
        setState(EMPTY);
        return;
      }
      const selection = selectionKey.split(",").map((entry) => {
        const [productUuid, quantity] = entry.split(":");
        return { productUuid, quantity: Number(quantity) };
      });
      void checkCartDesign(selection).then((result) => {
        if (active) {
          setState(result);
        }
      });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectionKey]);

  return state;
};
