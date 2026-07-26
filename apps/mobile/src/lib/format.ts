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
