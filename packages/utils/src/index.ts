import type { SelectOffers } from "services";

type ReviewerUser = {
  id: string;
  fullName?: string | null;
  primaryEmailAddress?: {
    emailAddress?: string | null;
  } | null;
};

/** Generates a random UUID v4. */
export const generateUuid = (): string => crypto.randomUUID();

/** Formats a numeric amount as whole-unit currency, e.g. "SAR 17,768". */
export const formatMoney = (amount: number, currency: string | null): string =>
  `${currency ?? "SAR"} ${Math.round(amount).toLocaleString("en-US")}`;

/** Formats a whole-number amount as SAR, e.g. 84200 -> "SAR 84,200". */
export const formatSar = (amount: number): string =>
  `SAR ${Math.round(amount).toLocaleString("en-US")}`;

/** Formats a decimal price string with its currency, e.g. "SAR 4,200". */
export const formatPrice = (price: string, currency: string | null): string =>
  `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`;

// Saudi VAT rate applied to BOQ/cart subtotals, as a whole-number percentage.
const VAT_PERCENT = 15;

/** Parse a decimal money value (string or number) into integer minor units. */
export const toMinorUnits = (value: string | number): number =>
  Math.round(Number(value) * 100);

/** Convert integer minor units back to a major-unit number (420055 -> 4200.55). */
export const fromMinorUnits = (minor: number): number => minor / 100;

/** Exact line total (unit price x quantity) in major units. */
export const lineTotal = (
  unitPrice: string | number,
  quantity: number,
): number => fromMinorUnits(toMinorUnits(unitPrice) * quantity);

export type CartTotals = {
  subtotal: number;
  vat: number;
  total: number;
};

/**
 * Subtotal, VAT, and total for a set of line items. All arithmetic runs in
 * integer minor units so no floating-point drift enters the money, converting
 * back to major units once at the end.
 */
export const summarizeCart = (
  lines: { unitPrice: string | number; quantity: number }[],
): CartTotals => {
  const subtotalMinor = lines.reduce(
    (sum, line) => sum + toMinorUnits(line.unitPrice) * line.quantity,
    0,
  );
  const vatMinor = Math.round((subtotalMinor * VAT_PERCENT) / 100);
  return {
    subtotal: fromMinorUnits(subtotalMinor),
    vat: fromMinorUnits(vatMinor),
    total: fromMinorUnits(subtotalMinor + vatMinor),
  };
};

/** Sum of an offer's product, install, and (optional) programming prices. */
export const offerTotal = (offer: SelectOffers): number =>
  fromMinorUnits(
    toMinorUnits(offer.productPrice) +
      toMinorUnits(offer.installPrice) +
      toMinorUnits(offer.programmingPrice ?? 0),
  );

/** Capitalizes the first letter of a string, e.g. "published" -> "Published". */
export const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** Converts a string into a URL-friendly slug, e.g. "Product Name" -> "product-name". */
export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Two-letter initials from a full name, e.g. "Zakaria Asad" -> "ZA". */
export const getInitials = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
};

/**
 * Splits a full name into the first/last pair Clerk expects when creating a
 * user, e.g. "Abdullah Al Mutairi" -> { firstName: "Abdullah", lastName: "Al
 * Mutairi" }.
 */
export const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
};

/** Best-effort display name for the Clerk reviewer recorded on a request. */
export const getReviewerName = (user: ReviewerUser | null | undefined) =>
  user?.fullName?.trim() || user?.primaryEmailAddress?.emailAddress || user?.id;
