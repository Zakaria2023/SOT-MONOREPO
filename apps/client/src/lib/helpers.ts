/** Formats a decimal price string with its currency, e.g. "SAR 4,200". */
export const formatPrice = (price: string, currency: string | null): string =>
  `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`;
