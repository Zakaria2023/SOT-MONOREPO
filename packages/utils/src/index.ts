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

/** Sum of an offer's product, install, and (optional) programming prices. */
export const offerTotal = (offer: SelectOffers): number =>
  Number(offer.productPrice) +
  Number(offer.installPrice) +
  Number(offer.programmingPrice ?? 0);

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
