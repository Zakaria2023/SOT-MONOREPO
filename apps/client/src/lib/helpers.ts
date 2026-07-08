import type { SelectOffers } from "services";

/** Formats a decimal price string with its currency, e.g. "SAR 4,200". */
export const formatPrice = (price: string, currency: string | null): string =>
  `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`;

/** Formats a numeric amount as whole-unit currency, e.g. "SAR 17,768". */
export const formatMoney = (amount: number, currency: string | null): string =>
  `${currency ?? "SAR"} ${Math.round(amount).toLocaleString("en-US")}`;

/** Sum of an offer's product, install, and (optional) programming prices. */
export const offerTotal = (offer: SelectOffers): number =>
  Number(offer.productPrice) +
  Number(offer.installPrice) +
  Number(offer.programmingPrice ?? 0);

/** Capitalizes the first letter of a string, e.g. "published" -> "Published". */
export const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** Two-letter initials from a full name, e.g. "Zakaria Asad" -> "ZA". */
export const getInitials = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
};
