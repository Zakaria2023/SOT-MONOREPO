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
