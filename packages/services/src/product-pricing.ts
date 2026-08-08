import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db";
import {
  ProductPrices,
  type SelectProductPrices,
} from "../../../db/schema/product-prices";
import { Products } from "../../../db/schema/products";
import { generateUuid } from "utils";
import { recordAudit } from "./catalog-audit";
import { ValidationError } from "./errors";
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

// ---------------------------------------------------------------------------
// Authoring a price
// ---------------------------------------------------------------------------

export type { SelectProductPrices };

export type ProductPriceInput = {
  productUuid: string;
  price: string;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  note: string | null;
};

/** Every window for a product, newest start first. */
export const listProductPrices = async (
  productUuid: string,
): Promise<SelectProductPrices[]> =>
  db
    .select()
    .from(ProductPrices)
    .where(eq(ProductPrices.productUuid, productUuid))
    .orderBy(desc(ProductPrices.effectiveFrom));

/**
 * Open a price window.
 *
 * Zero is allowed and null is not, which is the distinction the whole pricing
 * path now rests on: a 0.00 row is somebody stating that this product is free,
 * and an absent price is nobody having said anything. Only the first is
 * sellable.
 */
export const addProductPrice = async (
  input: ProductPriceInput,
  actor?: { name: string },
): Promise<string> => {
  const amount = Number(input.price);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ValidationError("A price must be a number, and not negative.");
  }
  if (
    input.effectiveTo !== null &&
    input.effectiveTo.getTime() <= input.effectiveFrom.getTime()
  ) {
    throw new ValidationError("A price window has to end after it starts.");
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new ValidationError("Currency has to be a three-letter code.");
  }

  const uuid = generateUuid();
  await db.insert(ProductPrices).values({
    uuid,
    productUuid: input.productUuid,
    price: amount.toFixed(2),
    currency: input.currency,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    note: input.note?.trim() || null,
    actorName: actor?.name ?? null,
  });

  // A price is the one change nobody can afford to be unable to explain. The row
  // already carries who set it; the audit is what makes it findable from the
  // other direction — "what happened to this product" rather than "what does
  // this product cost".
  await recordAudit({
    target: "product_price",
    action: "create",
    targetUuid: input.productUuid,
    targetLabel: `${amount.toFixed(2)} ${input.currency}`,
    actor: actor ? { uuid: "", name: actor.name } : undefined,
    changes: [
      { field: "from", from: null, to: input.effectiveFrom.toISOString() },
      {
        field: "until",
        from: null,
        to: input.effectiveTo?.toISOString() ?? "still in force",
      },
    ],
  });
  return uuid;
};

/**
 * Stop a window at an instant.
 *
 * Separate from deleting it: a price that applied last month is a fact about
 * orders placed last month, and removing the row would make those orders
 * unexplainable.
 */
export const closeProductPrice = async (
  uuid: string,
  at: Date,
): Promise<void> => {
  const [row] = await db
    .select()
    .from(ProductPrices)
    .where(eq(ProductPrices.uuid, uuid));
  if (!row) {
    throw new ValidationError("That price no longer exists.");
  }
  if (at.getTime() <= row.effectiveFrom.getTime()) {
    throw new ValidationError("A price window has to end after it starts.");
  }
  await db
    .update(ProductPrices)
    .set({ effectiveTo: at })
    .where(eq(ProductPrices.uuid, uuid));

  await recordAudit({
    target: "product_price",
    action: "update",
    targetUuid: row.productUuid,
    targetLabel: `${row.price} ${row.currency}`,
    changes: [
      { field: "until", from: row.effectiveTo, to: at.toISOString() },
    ],
  });
};

/**
 * Remove a window outright.
 *
 * For a row entered by mistake — a typo, the wrong product — and nothing else.
 * Closing is what ends a price that was genuinely in force.
 */
export const deleteProductPrice = async (uuid: string): Promise<void> => {
  const [row] = await db
    .select()
    .from(ProductPrices)
    .where(eq(ProductPrices.uuid, uuid));

  await db.delete(ProductPrices).where(eq(ProductPrices.uuid, uuid));

  if (row) {
    await recordAudit({
      target: "product_price",
      action: "delete",
      targetUuid: row.productUuid,
      targetLabel: `${row.price} ${row.currency}`,
    });
  }
};
