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

/**
 * What a searched, paginated list is asked for — the other half of
 * PaginatedResult.
 *
 * All three are optional because all three come off the URL, where any of them
 * may be absent; `resolvePagination` decides what a missing or unparseable page
 * means. `page`/`pageSize` admit strings for the same reason: search params
 * arrive as text and are never pre-parsed for us.
 *
 * A list that filters on more than a search box intersects this rather than
 * redeclaring it, so the extra filter is the only thing its type says.
 */
export type ListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

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
/**
 * A list query after the URL has been resolved into SQL bounds — the other half
 * of ListParams above, which is what arrives from a query string.
 *
 * Named separately and deliberately: ListParams carries `page`/`pageSize` and
 * this carries `limit`/`offset`, and the two were previously spelled
 * `BoqListParams` and `BoqsListParams` — one letter apart, different meanings,
 * both offered by autocomplete. This shape was also redeclared verbatim in four
 * service files, so a change to one was a change to none of the others.
 */
export type ListQuery = {
  search?: string;
  limit: number;
  offset: number;
};

export const paginate = async <T>(
  params: { page?: number | string | null; pageSize?: number | string | null },
  fetcher: (args: Pick<ListQuery, "limit" | "offset">) => Promise<{
    items: T[];
    total: number;
  }>,
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

/** One numeric facet's bounds. Either end may be left open. */
export type SpecRange = {
  min?: number;
  max?: number;
};

/**
 * A numeric facet is a range, not a set of values to tick, so it travels in its
 * own param: `range=key:min:max`, with either end blank for "no bound"
 * (`range=ports:24:` is "24 or more").
 *
 * Kept apart from `spec` deliberately. Folding a range into that encoding would
 * make `spec=speed:1000` ambiguous — a stored value of exactly 1000, or a floor of
 * 1000 — and the two filter completely differently.
 */
export const SPEC_RANGE_PARAM = "range";

export const encodeSpecRangeParam = (key: string, range: SpecRange): string =>
  `${key}:${range.min ?? ""}:${range.max ?? ""}`;

/** Parse repeated `range` params into the map getProducts filters by. */
export const parseSpecRangeParams = (
  values: string | string[] | undefined,
): Record<string, SpecRange> => {
  const raw = values === undefined ? [] : [values].flat();
  const parsed: Record<string, SpecRange> = {};

  for (const entry of raw) {
    const parts = entry.split(":");
    // key, min, max — exactly three. Anything else is a hand-edited URL.
    if (parts.length !== 3) {
      continue;
    }
    const [key, rawMin, rawMax] = parts;
    if (!key) {
      continue;
    }
    const min = rawMin === "" ? undefined : Number(rawMin);
    const max = rawMax === "" ? undefined : Number(rawMax);
    // A bound that is not a finite number is dropped rather than treated as 0,
    // which would filter the list to nothing and look like a broken catalogue.
    const range: SpecRange = {};
    if (min !== undefined && Number.isFinite(min)) {
      range.min = min;
    }
    if (max !== undefined && Number.isFinite(max)) {
      range.max = max;
    }
    if (range.min === undefined && range.max === undefined) {
      continue;
    }
    parsed[key] = range;
  }
  return parsed;
};

// ---------------------------------------------------------------------------
// Attribute values
//
// A product's value for an attribute is stored TYPED — a number as a number, a
// multi-select as an array of option values, a boolean as true/false. The old
// comma-joined-string encoding is gone: it produced NaN on any value carrying a
// unit and corrupted outright on an option label containing a comma.
//
// Kept structural (no db import) so the server and browser share one formatter.
// ---------------------------------------------------------------------------

export type TypedSpecValue = number | boolean | string | string[];

/**
 * Renders a stored value for display: option values swapped for their labels,
 * a unit appended to a number, a boolean read as Yes/No.
 *
 * Returns "" for an empty value so callers can filter unset attributes out of a
 * spec table rather than rendering a row of dashes.
 */
export const formatSpecValue = (
  value: TypedSpecValue | null | undefined,
  unit?: string | null,
  optionLabels?: Record<string, string>,
): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const suffix = unit?.trim() ? ` ${unit.trim()}` : "";

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? `${value}${suffix}` : "";
  }
  if (Array.isArray(value)) {
    const labelled = value
      .map((entry) => optionLabels?.[entry] ?? entry)
      .filter((entry) => entry.trim() !== "");
    return labelled.join(", ");
  }
  const text = value.trim();
  if (text === "") {
    return "";
  }
  // A single option value still deserves its label; a free string passes through.
  return optionLabels?.[text] ?? `${text}${suffix}`;
};

/** Whether a stored value counts as filled in. 0 and false are real answers. */
export const hasSpecValue = (
  value: TypedSpecValue | null | undefined,
): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  return true;
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

// Spec facet selections travel in the URL as repeated `spec=key:value` params
// (e.g. ?spec=cable-grade:Cat6&spec=cable-grade:Cat6a&spec=color:Black). Spec
// keys are slugified and never contain a colon, so the first colon separates
// the two halves and the value may contain its own.
export const SPEC_PARAM = "spec";

export const encodeSpecParam = (key: string, value: string): string =>
  `${key}:${value}`;

/** Parse repeated `spec` params into the map getProducts filters by. */
export const parseSpecParams = (
  values: string | string[] | undefined,
): Record<string, string[]> => {
  const raw = values === undefined ? [] : [values].flat();
  const parsed: Record<string, string[]> = {};

  for (const entry of raw) {
    const separator = entry.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (!value) {
      continue;
    }
    const current = parsed[key] ?? [];
    if (!current.includes(value)) {
      current.push(value);
    }
    parsed[key] = current;
  }
  return parsed;
};

// ---------------------------------------------------------------------------
// Rate limiting — for endpoints that do real work without authentication.
// ---------------------------------------------------------------------------

type RateBucket = { count: number; resetAt: number };

// Per-process, in memory. Deliberately modest: a guard against one caller
// hammering an expensive public endpoint, not a distributed limiter. Several
// instances each allow the window and a restart clears it — if this ever has to
// be exact it belongs in Redis, not a module-level Map.
const rateBuckets = new Map<string, RateBucket>();

// Bounded so a flood of spoofed addresses cannot grow the map without limit.
const MAX_TRACKED_CALLERS = 5000;

export type RateLimitVerdict = {
  ok: boolean;
  // Seconds until the window reopens, so a 429 can say when to retry — a
  // refusal with no wait just invites a tighter loop.
  retryAfterSeconds: number;
};

/**
 * Whether `key` is within `limit` requests per `windowMs`.
 *
 * Takes a caller key rather than a request so it stays free of any framework;
 * the transport decides what identifies a caller.
 */
export const withinRateLimit = (
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitVerdict => {
  // Opportunistic sweep — cheaper than a timer, and only when it matters.
  if (rateBuckets.size > MAX_TRACKED_CALLERS) {
    for (const [entry, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) {
        rateBuckets.delete(entry);
      }
    }
  }

  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true, retryAfterSeconds: 0 };
};

/**
 * The client address from a proxy chain. The first entry is the client; the
 * rest are hops, so keying on the whole header would let one client occupy a
 * new bucket every time it took a different route.
 */
export const clientAddress = (
  forwardedFor: string | null,
  realIp: string | null,
): string => {
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return realIp ?? "unknown";
};

/**
 * What a Server Action hands back to the form that called it.
 *
 * Declared once because it was declared eight times: the same two optional
 * fields under eight names — ActionResult, BrandActionResult,
 * PartnerDiscountsActionResult, GovernmentRequestState, OfferActionState and so
 * on — differing only in which page they sat on.
 *
 * Both fields are optional and that is deliberate. An action that redirects on
 * success never returns at all, so `success` stays unset; one that reports a
 * refusal sets `error` and nothing else. A required field here would force every
 * action to answer a question half of them do not have.
 *
 * Actions needing more intersect it rather than redeclare it, so the extra field
 * is the only thing their type says — see ProductActionResult and the library's
 * warnings.
 */
export type ActionResult = {
  error?: string;
  success?: boolean;
};

/**
 * The message a Server Action shows when something threw.
 *
 * Every action in every app ends in the same catch: report what the service
 * said if it said anything, otherwise a fallback the action wrote. That was
 * spelled out roughly forty times, and the cost of the duplication was not the
 * typing — it was that half the copies dropped the service's own message and
 * showed only the fallback, so a `ValidationError` naming the exact fix arrived
 * at the user as "Failed to save".
 *
 * Returns the object rather than the string so it drops straight into any
 * result shape: every one of them has `error?: string`, and the extra fields
 * (`success`, `productUuid`) stay optional.
 */
export const fail = (error: unknown, fallback: string): { error: string } => ({
  error: error instanceof Error ? error.message : fallback,
});
