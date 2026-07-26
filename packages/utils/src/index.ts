// The three price fields offerTotal needs. Typed structurally (rather than
// importing SelectOffers from "services") so utils has no dependency on
// services — keeping the package graph one-directional (services -> utils).
type OfferPrices = {
  productPrice: string | number | null;
  installPrice: string | number | null;
  programmingPrice?: string | number | null;
};

type ReviewerUser = {
  id: string;
  fullName?: string | null;
  primaryEmailAddress?: {
    emailAddress?: string | null;
  } | null;
};

/** Generates a random UUID v4. */
export const generateUuid = (): string => crypto.randomUUID();

/** A page of results plus the metadata a list UI needs to paginate. */
export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Default rows per page for admin list tables. */
export const DEFAULT_PAGE_SIZE = 10;

/** Cards shown per column on the reorder boards (categories & brands). */
export const BOARD_PAGE_SIZE = 8;

/**
 * Normalizes raw page/pageSize values (e.g. straight off URL search params,
 * so possibly undefined, non-numeric, or out of range) into safe bounds and
 * the matching SQL offset.
 */
export const resolvePagination = (
  page?: number | string | null,
  pageSize?: number | string | null,
) => {
  const size = Math.max(1, Math.floor(Number(pageSize) || DEFAULT_PAGE_SIZE));
  const current = Math.max(1, Math.floor(Number(page) || 1));
  return { page: current, pageSize: size, offset: (current - 1) * size };
};

/** Wraps a fetched page of rows and its total count into a PaginatedResult. */
export const buildPaginatedResult = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> => ({
  items,
  total,
  page,
  pageSize,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

/**
 * End-to-end pagination for a list action: normalizes the raw page/pageSize
 * params, hands the resolved `limit`/`offset` to `fetcher` (which returns the
 * page's rows and the unfiltered total), and wraps the result. Removes the
 * resolve/build boilerplate repeated across every paginated action.
 */
export const paginate = async <T>(
  params: { page?: number | string | null; pageSize?: number | string | null },
  fetcher: (args: {
    limit: number;
    offset: number;
  }) => Promise<{ items: T[]; total: number }>,
): Promise<PaginatedResult<T>> => {
  const { page, pageSize, offset } = resolvePagination(
    params.page,
    params.pageSize,
  );
  const { items, total } = await fetcher({ limit: pageSize, offset });
  return buildPaginatedResult(items, total, page, pageSize);
};

/** Formats a numeric amount as whole-unit currency, e.g. "SAR 17,768". */
export const formatMoney = (amount: number, currency: string | null): string =>
  `${currency ?? "SAR"} ${Math.round(amount).toLocaleString("en-US")}`;

/** Formats a whole-number amount as SAR, e.g. 84200 -> "SAR 84,200". */
export const formatSar = (amount: number): string =>
  `SAR ${Math.round(amount).toLocaleString("en-US")}`;

/**
 * Formats a decimal price string with its currency, e.g. "SAR 4,200". A product
 * may have no price yet (a partner sets it when quoting), so fall back to a
 * "Price on request" label when it's missing.
 */
export const formatPrice = (
  price: string | null,
  currency: string | null,
): string =>
  price
    ? `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`
    : "Price on request";

// Saudi VAT rate applied to BOQ/cart subtotals, as a whole-number percentage.
const VAT_PERCENT = 15;

/**
 * Parse a decimal money value into integer minor units. A missing price (null)
 * counts as zero, so an unpriced product doesn't break cart/BOQ totals.
 */
export const toMinorUnits = (value: string | number | null): number =>
  Math.round(Number(value ?? 0) * 100);

/** Convert integer minor units back to a major-unit number (420055 -> 4200.55). */
export const fromMinorUnits = (minor: number): number => minor / 100;

/** Exact line total (unit price x quantity) in major units. */
export const lineTotal = (
  unitPrice: string | number | null,
  quantity: number,
): number => fromMinorUnits(toMinorUnits(unitPrice) * quantity);

/**
 * Apply a whole-number percent discount to a price, returning the discounted
 * amount in major units. All math runs in integer minor units to avoid
 * floating-point drift; a null price counts as 0. The percent is clamped to
 * 0–100 (stacked partner discounts are already capped at 100).
 */
export const applyPercentDiscount = (
  price: string | number | null,
  percent: number,
): number => {
  const safePercent = Math.min(100, Math.max(0, percent));
  return fromMinorUnits(
    Math.round((toMinorUnits(price) * (100 - safePercent)) / 100),
  );
};

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
  lines: { unitPrice: string | number | null; quantity: number }[],
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
export const offerTotal = (offer: OfferPrices): number =>
  fromMinorUnits(
    toMinorUnits(offer.productPrice) +
      toMinorUnits(offer.installPrice) +
      toMinorUnits(offer.programmingPrice ?? 0),
  );

/**
 * Groups card digits into blocks of four for display, e.g.
 * "4242424242424242" -> "4242 4242 4242 4242". Caps at 19 digits.
 */
export const formatCardNumber = (value: string): string =>
  value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();

/** Formats a card expiry as MM/YY while typing, e.g. "1230" -> "12/30". */
export const formatCardExpiry = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

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

// A multi-select spec's chosen options are stored comma-joined in the product's
// flat attribute map (e.g. "802.3af, 802.3at"). These two helpers move between
// that stored string and the individual option values the UI works with.
export const parseSpecValues = (raw: string | null | undefined): string[] =>
  raw
    ? raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

export const serializeSpecValues = (values: string[]): string =>
  values.join(", ");

// A range spec's value is stored as "from - to" (e.g. "10 - 20", "-20 - 60") —
// a plain number never contains " - ", so that separator distinguishes the two.
export const RANGE_SEPARATOR = " - ";

export const serializeSpecRange = (from: string, to: string): string =>
  `${from.trim()}${RANGE_SEPARATOR}${to.trim()}`;

/** Splits a stored range value into its raw "from"/"to" parts for editing. */
export const splitSpecRange = (
  raw: string | null | undefined,
): [string, string] => {
  if (!raw) {
    return ["", ""];
  }
  const at = raw.indexOf(RANGE_SEPARATOR);
  if (at === -1) {
    return [raw, ""];
  }
  return [raw.slice(0, at), raw.slice(at + RANGE_SEPARATOR.length)];
};

/**
 * Renders a stored spec value for display, appending the unit.
 *
 * Handles the three storage shapes a spec value can take:
 *   range  "220 - 240" + "V" → "220 – 240 V"   (unit once, en dash)
 *   multi  "802.3af, 802.3at" → "802.3af, 802.3at"  (option labels, no unit)
 *   plain  "45" + "W" → "45 W"
 *
 * Returns "" for an empty value so callers can filter unset attributes.
 */
export const formatSpecValue = (
  raw: string | null | undefined,
  unit?: string | null,
): string => {
  // The separator is checked before trimming: "10 - " trims to "10 -", which
  // would no longer look like a range.
  const stored = raw ?? "";
  const value = stored.trim();
  if (value === "") {
    return "";
  }
  const trimmedUnit = unit?.trim() ?? "";
  const suffix = trimmedUnit === "" ? "" : ` ${trimmedUnit}`;

  // A half-filled range ("10 - ") must not render its dangling separator.
  if (stored.includes(RANGE_SEPARATOR)) {
    const [rawFrom, rawTo] = splitSpecRange(stored);
    const from = rawFrom.trim();
    const to = rawTo.trim();
    if (from !== "" && to !== "") {
      return `${from} – ${to}${suffix}`;
    }
    const only = from === "" ? to : from;
    return only === "" ? "" : `${only}${suffix}`;
  }

  const parts = parseSpecValues(value);
  if (parts.length > 1) {
    return parts.join(", ");
  }
  return `${value}${suffix}`;
};

// The UX-facing input type of a library attribute. Kept structural (no db
// import) so both the server library builder and client components can share
// one resolver.
export type ResolvedSpecInputType =
  | "number"
  | "single_select"
  | "multi_select"
  | "boolean"
  | "text";

type SpecInputTypeSource = {
  inputType?: string | null;
  valueType?: string | null;
  allowMultiple?: boolean | null;
  options?: { value: string }[] | null;
};

/**
 * The attribute's input type, derived for legacy rows that predate the
 * `inputType` column: a numeric spec is a number, an exactly-Yes/No option set
 * is a boolean, a multi-value select is multi_select, and an option-less
 * select is free text.
 */
export const resolveSpecInputType = (
  spec: SpecInputTypeSource,
): ResolvedSpecInputType => {
  if (spec.inputType) {
    return spec.inputType as ResolvedSpecInputType;
  }
  if (spec.valueType === "number") {
    return "number";
  }
  const values = (spec.options ?? []).map((option) => option.value);
  const isYesNo =
    values.length === 2 && values.includes("Yes") && values.includes("No");
  if (isYesNo) {
    return "boolean";
  }
  if (spec.allowMultiple) {
    return "multi_select";
  }
  return values.length === 0 ? "text" : "single_select";
};

/**
 * Parses a stored range spec value back into numeric bounds, or null when it
 * isn't a valid "from - to" pair. The rule engine reads these bounds: a range
 * consumer is budgeted at its max (worst case), a range provider at its min
 * (guaranteed capacity).
 */
export const parseSpecRange = (
  raw: string | null | undefined,
): { min: number; max: number } | null => {
  if (!raw) {
    return null;
  }
  const at = raw.indexOf(RANGE_SEPARATOR);
  if (at === -1) {
    return null;
  }
  const min = Number(raw.slice(0, at).trim());
  const max = Number(raw.slice(at + RANGE_SEPARATOR.length).trim());
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  return { min, max };
};

/** Turns a slug/key back into a readable Title Case label, e.g. "poe-standard" -> "Poe Standard". */
export const humanizeSlug = (value: string): string =>
  value
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

/**
 * Derives a short uppercase SKU segment from a name, e.g. "Switches" -> "SW",
 * "Hyundai Electric" -> "HE". Prefers word initials, falling back to the first
 * letters of a single word. Returns "XX" when the name has no letters or digits.
 * The result is at most `length` characters.
 */
export const deriveCode = (name: string, length = 2): string => {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, "").charAt(0))
    .join("")
    .toUpperCase();
  if (initials.length >= length) {
    return initials.slice(0, length);
  }
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, length) || "XX";
};

/**
 * Picks a code that isn't already in `taken`, staying within `maxLength`
 * characters. Starts from `base`, then appends an incrementing numeric suffix
 * (SW -> SW2 -> SW3 ...) until a free code is found.
 */
export const resolveUniqueCode = (
  base: string,
  taken: Set<string>,
  maxLength = 4,
): string => {
  const start = base.slice(0, maxLength);
  if (!taken.has(start)) {
    return start;
  }
  for (let n = 2; ; n++) {
    const suffix = String(n);
    const candidate = start.slice(0, maxLength - suffix.length) + suffix;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
};

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

// ---------------------------------------------------------------------------
// Facet choices — the storefront half of the ordered/unordered rule.
// ---------------------------------------------------------------------------

// Just enough of a facet to judge a choice by. Structural so this stays free
// of any database or service type.
export type ChoosableFacet = {
  key: string;
  // Whether the option list is an ordered scale.
  ordered: boolean;
  // The options in scale order.
  options: string[];
};

/**
 * Expand a shopper's facet choices into the product values that satisfy them.
 *
 * On an UNORDERED attribute a choice is itself: pick 6GHz and only 6GHz will
 * do. On an ORDERED one the choice is a CEILING, because the shopper is
 * stating what they HAVE while the product's value is what it NEEDS. Picking
 * Port Speed 1G means "my network gives 1G", so a device needing 10G is out
 * and anything at or below 1G still fits.
 */
export const expandFacetChoices = (
  facets: ChoosableFacet[],
  selected: Record<string, string[]>,
): Record<string, string[]> => {
  const expanded: Record<string, string[]> = {};

  for (const [key, values] of Object.entries(selected)) {
    const facet = facets.find((entry) => entry.key === key);
    if (!facet || values.length === 0) {
      continue;
    }
    if (!facet.ordered) {
      expanded[key] = values;
      continue;
    }
    // The highest rung ticked is the ceiling; everything at or below qualifies.
    const ceiling = Math.max(
      ...values.map((value) => facet.options.indexOf(value)),
    );
    // A choice that is no longer on the scale can't be ranked — fall back to
    // matching it literally rather than silently widening to everything.
    expanded[key] = ceiling < 0 ? values : facet.options.slice(0, ceiling + 1);
  }
  return expanded;
};

export * from "./rule-validation";
