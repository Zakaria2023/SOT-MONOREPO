import { inArray } from "drizzle-orm";
import { db } from "../../../db";
import { ProductPrices } from "../../../db/schema/product-prices";
import { Products } from "../../../db/schema/products";
import {
  priceInForce,
  type DatedPrice,
  type PriceableLine,
} from "./price-resolution";

// The read half of effective dating. Kept apart from `priceInForce` so the
// window arithmetic — the exclusive end, the overlap rule, the deliberate gap —
// is tested without arranging dates in a live catalogue first.

export type PriceableRequest = {
  productUuid: string;
  name: string;
  quantity: number;
};

/**
 * Price each line at the instant given.
 *
 * PRECEDENCE, stated rather than left to whichever query returns first:
 *   1. the dated window in force at `asOf`
 *   2. `Products.price`, for a product nobody has dated yet
 *   3. nothing — and an unpriced line is refused, never sold for zero
 *
 * Two queries whatever the size of the basket. Never one per line: the shared
 * database has a hard connection ceiling and this runs on every cart render.
 */
export const priceLinesAsOf = async (
  requests: PriceableRequest[],
  asOf: Date,
): Promise<PriceableLine[]> => {
  if (requests.length === 0) {
    return [];
  }
  const uuids = requests.map((request) => request.productUuid);

  const [fallbacks, windows] = await Promise.all([
    db
      .select({
        uuid: Products.uuid,
        price: Products.price,
        currency: Products.currency,
      })
      .from(Products)
      .where(inArray(Products.uuid, uuids)),
    db
      .select({
        productUuid: ProductPrices.productUuid,
        price: ProductPrices.price,
        currency: ProductPrices.currency,
        effectiveFrom: ProductPrices.effectiveFrom,
        effectiveTo: ProductPrices.effectiveTo,
      })
      .from(ProductPrices)
      .where(inArray(ProductPrices.productUuid, uuids)),
  ]);

  const byProduct = new Map<string, DatedPrice[]>();
  for (const window of windows) {
    const existing = byProduct.get(window.productUuid);
    const entry: DatedPrice = {
      price: window.price,
      currency: window.currency,
      effectiveFrom: window.effectiveFrom,
      effectiveTo: window.effectiveTo,
    };
    if (existing) {
      existing.push(entry);
      continue;
    }
    byProduct.set(window.productUuid, [entry]);
  }

  const fallbackByUuid = new Map(
    fallbacks.map((product) => [product.uuid, product] as const),
  );

  return requests.map((request) => {
    const dated = priceInForce(
      byProduct.get(request.productUuid) ?? [],
      asOf,
    );
    if (dated) {
      return {
        productUuid: request.productUuid,
        name: request.name,
        price: dated.price,
        currency: dated.currency,
        quantity: request.quantity,
      };
    }

    // A product WITH dated windows, none of which covers this instant, is
    // deliberately unpriced rather than falling back. Somebody dated that price
    // list on purpose, and quoting an undated number outside every window they
    // set would undo the decision.
    const hasWindows = (byProduct.get(request.productUuid) ?? []).length > 0;
    const fallback = fallbackByUuid.get(request.productUuid);
    return {
      productUuid: request.productUuid,
      name: request.name,
      price: hasWindows ? null : (fallback?.price ?? null),
      currency: fallback?.currency ?? null,
      quantity: request.quantity,
    };
  });
};
