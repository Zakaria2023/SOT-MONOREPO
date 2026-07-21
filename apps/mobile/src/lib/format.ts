// Local copies of the shared money helpers (packages/utils). The mobile app
// runs under Metro, which won't transform the workspace `utils` package's
// raw-TS entry point, so cross-app helpers are kept here instead.

// Keeps decimals; "Price on request" when the price is null — matches the
// client's product-card/hero formatting.
export const formatPrice = (
  price: string | null,
  currency: string | null,
): string =>
  price
    ? `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`
    : "Price on request";

// Rounds to whole units — used for cart/offer totals.
export const formatMoney = (amount: number, currency = "SAR"): string =>
  `${currency} ${Math.round(amount).toLocaleString("en-US")}`;

export const VAT_PERCENT = 15;

export const summarizeCart = (subtotal: number) => {
  const vat = (subtotal * VAT_PERCENT) / 100;
  return { subtotal, vat, total: subtotal + vat };
};
