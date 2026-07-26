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

/** Parse a decimal money value into integer minor units. */
export const toMinorUnits = (value: string | number | null): number =>
  Math.round(Number(value ?? 0) * 100);

/** Integer minor units back to major units (420055 -> 4200.55). */
export const fromMinorUnits = (minor: number): number => minor / 100;

/**
 * Subtotal, VAT and total for a set of cart lines.
 *
 * Mirrors summarizeCart in packages/utils, which the web cart uses: integer
 * minor units throughout, and VAT rounded to the cent before it is added.
 * This previously took an already-floated subtotal and applied VAT without
 * rounding, so the same basket could total differently here than on the web —
 * and the drift grew with the number of lines.
 *
 * Duplicated rather than imported because mobile talks to this system over
 * HTTP only and never pulls in a workspace package.
 */
export const summarizeCart = (
  lines: { unitPrice: string | number | null; quantity: number }[],
) => {
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

// A range spec is stored as "from - to"; a plain number never contains " - ",
// so that separator distinguishes the two.
const RANGE_SEPARATOR = " - ";

/**
 * Render a stored spec value the way the web does: a range reads "220 – 240 V",
 * a multi-select reads "802.3af, 802.3at", a plain number carries its unit.
 * Returns "" for an unset value so callers can drop the row.
 *
 * Mirrors formatSpecValue in packages/utils. Mobile deliberately keeps its own
 * copy — it talks to this system over HTTP only and never imports workspace
 * packages, so the RN bundle stays free of anything server-side.
 */
export const formatSpecValue = (
  raw: string | null | undefined,
  unit?: string | null,
): string => {
  // Checked before trimming: "10 - " trims to "10 -", which no longer looks
  // like a range.
  const stored = raw ?? "";
  const value = stored.trim();
  if (value === "") {
    return "";
  }
  const trimmedUnit = unit?.trim() ?? "";
  const suffix = trimmedUnit === "" ? "" : ` ${trimmedUnit}`;

  if (stored.includes(RANGE_SEPARATOR)) {
    const [rawFrom = "", rawTo = ""] = stored.split(RANGE_SEPARATOR);
    const from = rawFrom.trim();
    const to = rawTo.trim();
    if (from !== "" && to !== "") {
      return `${from} – ${to}${suffix}`;
    }
    const only = from === "" ? to : from;
    return only === "" ? "" : `${only}${suffix}`;
  }

  // Multi-selects are stored comma-joined and carry no unit.
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return parts.join(", ");
  }
  return `${value}${suffix}`;
};
