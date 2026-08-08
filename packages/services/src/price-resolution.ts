import { applyPercentDiscount, fromMinorUnits, toMinorUnits } from "utils";

// ---------------------------------------------------------------------------
// THE ONE PLACE A PRICE IS WORKED OUT.
//
// Two lines come out of it, and which one a surface may render is not a styling
// choice:
//
//   LIST   the public MSRP. The only price a customer surface ever shows per
//          product.
//   NET    what this buyer actually pays, as ONE lump sum at the cart. Never
//          per line, because a per-line net price is the partner's buy-in price,
//          and publishing that publishes the margin.
//
// The rule that shapes everything here: an absent price is NOT zero.
//
// `toMinorUnits(value ?? 0)` turns a product with no price into 0.00, and the
// order writes a line saying the product costs nothing. Nothing further down
// can tell that apart from a genuinely free item, and the sale completes. So an
// unpriced line is refused and reported, never totalled — the same reasoning
// that stops the design check calling an unread product a pass.
//
// Mixed currencies are refused for the same reason. Adding 100 SAR to 100 USD
// produces 200 of nothing, and taking the first line's currency for the total
// is how that goes unnoticed.
// ---------------------------------------------------------------------------

export type PriceableLine = {
  productUuid: string;
  name: string;
  // As stored — a decimal string, or null when the product has no price.
  price: string | number | null;
  currency: string | null;
  quantity: number;
};

export type PricedLine = {
  productUuid: string;
  name: string;
  quantity: number;
  // List only. The net unit price is deliberately absent from this type: a
  // surface cannot leak a number it was never given.
  listUnit: number;
  listTotal: number;
};

export type UnpricedLine = {
  productUuid: string;
  name: string;
  quantity: number;
  reason: "no_price" | "wrong_currency";
};

export type ResolvedPricing = {
  currency: string;
  lines: PricedLine[];
  // Lines that could not be priced. Reported, never totalled as zero.
  unpriced: UnpricedLine[];
  listSubtotal: number;
  // The buyer's stacked partner discount, applied once to the subtotal.
  discountPercent: number;
  discountAmount: number;
  netSubtotal: number;
  // False when anything could not be priced. A caller must not present these
  // totals as a quote, and must not let an order be placed on them.
  complete: boolean;
  // The instant the prices were read. Recorded so a quote can say which price
  // book it was built from — and so effective dating has somewhere to attach.
  asOf: Date;
};

export type ResolveInput = {
  lines: PriceableLine[];
  discountPercent: number;
  asOf: Date;
  // Everything must agree with this. Taken from the first priced line when not
  // given, which is the common case of a single-currency catalogue.
  currency?: string;
};

/**
 * Price a selection.
 *
 * Quantity enters as a multiplier on the line and nowhere else: there are no
 * quantity breaks in this catalogue, and inventing a break table nobody asked
 * for would put a discount in front of buyers that no one agreed to. When breaks
 * arrive they attach here, per line, before the subtotal.
 */
export const resolvePricing = (input: ResolveInput): ResolvedPricing => {
  const priced: PricedLine[] = [];
  const unpriced: UnpricedLine[] = [];

  const currency =
    input.currency ??
    input.lines.find((line) => line.price !== null)?.currency ??
    "SAR";

  for (const line of input.lines) {
    if (line.price === null || line.price === "") {
      unpriced.push({
        productUuid: line.productUuid,
        name: line.name,
        quantity: line.quantity,
        reason: "no_price",
      });
      continue;
    }
    // A line in another currency is not converted. There is no rate in this
    // system, and inventing one would be a guess with money on it.
    if ((line.currency ?? currency) !== currency) {
      unpriced.push({
        productUuid: line.productUuid,
        name: line.name,
        quantity: line.quantity,
        reason: "wrong_currency",
      });
      continue;
    }

    const listUnitMinor = toMinorUnits(line.price);
    priced.push({
      productUuid: line.productUuid,
      name: line.name,
      quantity: line.quantity,
      listUnit: fromMinorUnits(listUnitMinor),
      listTotal: fromMinorUnits(listUnitMinor * line.quantity),
    });
  }

  // Summed in integer minor units throughout, so the discount and the total add
  // back to the subtotal exactly rather than to 0.09000000001.
  const listSubtotal = fromMinorUnits(
    priced.reduce(
      (sum, line) => sum + toMinorUnits(line.listUnit) * line.quantity,
      0,
    ),
  );

  const discountPercent = Math.min(100, Math.max(0, input.discountPercent));
  const netSubtotal = applyPercentDiscount(listSubtotal, discountPercent);
  const discountAmount = fromMinorUnits(
    toMinorUnits(listSubtotal) - toMinorUnits(netSubtotal),
  );

  return {
    currency,
    lines: priced,
    unpriced,
    listSubtotal,
    discountPercent,
    discountAmount,
    netSubtotal,
    complete: unpriced.length === 0,
    asOf: input.asOf,
  };
};

/**
 * One sentence naming what could not be priced.
 *
 * Built from the parts rather than left to each caller, so the refusal reads the
 * same on the web, on mobile, and in the error an order creation throws.
 */
export const describeUnpriced = (unpriced: UnpricedLine[]): string => {
  if (unpriced.length === 0) {
    return "";
  }
  const noPrice = unpriced.filter((line) => line.reason === "no_price");
  const wrongCurrency = unpriced.filter(
    (line) => line.reason === "wrong_currency",
  );
  const parts: string[] = [];
  if (noPrice.length > 0) {
    parts.push(
      `${noPrice.map((line) => line.name).join(", ")} ${
        noPrice.length === 1 ? "has no price" : "have no price"
      }`,
    );
  }
  if (wrongCurrency.length > 0) {
    parts.push(
      `${wrongCurrency
        .map((line) => line.name)
        .join(", ")} ${
        wrongCurrency.length === 1 ? "is priced" : "are priced"
      } in another currency`,
    );
  }
  return parts.join("; ");
};
