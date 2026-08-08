import { inArray } from "drizzle-orm";
import { db } from "../../../db";
import { Products } from "../../../db/schema/products";
import { assessSupply, type SupplyAssessment, type SupplyLine } from "./supply";

// The database side of P11. `supply.ts` decides what a status MEANS; this reads
// the statuses. Split for the reason every engine in this repo is split: the
// deciding is what needs testing, and a decision you cannot test without a
// database is one nobody tests.

export type SupplyRequest = {
  productUuid: string;
  quantity: number;
};

/**
 * Assess a set of lines against what the catalogue currently says it can supply.
 *
 * Two columns for however many lines, in one query. Never one read per line — the
 * connection ceiling is shared across five apps and a basket-sized fan-out is how
 * a checkout takes the pool down.
 *
 * A line whose product has been deleted is reported as unavailable rather than
 * skipped. Dropping it would let a basket referencing a removed product pass the
 * gate by virtue of having nothing to check.
 */
export const assessSupplyFor = async (
  requests: SupplyRequest[],
): Promise<SupplyAssessment> => {
  if (requests.length === 0) {
    return assessSupply([]);
  }

  const rows = await db
    .select({
      uuid: Products.uuid,
      name: Products.name,
      status: Products.status,
      isAvailable: Products.isAvailable,
    })
    .from(Products)
    .where(
      inArray(
        Products.uuid,
        requests.map((request) => request.productUuid),
      ),
    );

  const byUuid = new Map(rows.map((row) => [row.uuid, row]));

  const lines: SupplyLine[] = requests.map((request) => {
    const product = byUuid.get(request.productUuid);
    if (!product) {
      return {
        productUuid: request.productUuid,
        name: "a product that no longer exists",
        status: null,
        // The manual switch is how `classifySupply` refuses, so a missing
        // product borrows it. It is the truth of the matter either way: this
        // cannot be sold.
        isAvailable: false,
        quantity: request.quantity,
      };
    }
    return {
      productUuid: product.uuid,
      name: product.name,
      status: product.status,
      isAvailable: product.isAvailable,
      quantity: request.quantity,
    };
  });

  return assessSupply(lines);
};

/**
 * Whether one product may be put in a basket at all.
 *
 * Used at add-to-cart. Deliberately NOT the same check as the order gate: a
 * product that goes out of stock while it sits in somebody's cart has to stay
 * visible there, or they cannot see what to remove. So this refuses at the door
 * and the order path refuses at the till, and the cart in between shows the
 * problem rather than hiding it.
 */
export const canAddToBasket = async (
  productUuid: string,
): Promise<{ allowed: boolean; reason: string | null }> => {
  const assessment = await assessSupplyFor([{ productUuid, quantity: 1 }]);
  const [line] = assessment.lines;
  if (!line || line.state !== "unavailable") {
    return { allowed: true, reason: null };
  }
  return { allowed: false, reason: line.note };
};
