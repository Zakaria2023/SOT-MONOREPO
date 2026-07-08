/**
 * Generates a random UUID v4.
 */
export const generateUuid = () => crypto.randomUUID();

/**
 * Formats an amount as a whole-number SAR figure (e.g. 84200 -> "SAR 84,200").
 */
export const formatSar = (amount: number): string =>
  `SAR ${Math.round(amount).toLocaleString("en-US")}`;

/**
 * Converts a string into a URL-friendly slug (e.g. "Product Name" -> "product-name").
 */
export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type ReviewerUser = {
  id: string;
  fullName?: string | null;
  primaryEmailAddress?: {
    emailAddress?: string | null;
  } | null;
};

/**
 * Splits a single full-name string into the first/last name pair Clerk expects
 * when creating a user (e.g. "Abdullah Al Mutairi" -> { firstName: "Abdullah",
 * lastName: "Al Mutairi" }).
 */
export const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
};

/**
 * Best-effort display name for the Clerk reviewer recorded on a partner request.
 */
export const getReviewerName = (user: ReviewerUser | null | undefined) =>
  user?.fullName?.trim() || user?.primaryEmailAddress?.emailAddress || user?.id;
