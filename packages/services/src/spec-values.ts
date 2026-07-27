import { UNIT_DIMENSIONS, type SpecificationType } from "../../../db/enum";
import type { ProductValue, ProductValues, SpecOption } from "../../../db/types";

// ---------------------------------------------------------------------------
// Reading attribute values, and the unit safety that has to happen before any
// arithmetic. Pure — no database, no framework.
//
// Everything above this layer (the predicate evaluator, the relationship
// engine) reads values THROUGH here, so there is exactly one place that decides
// what "this product's value for that attribute" means.
// ---------------------------------------------------------------------------

// The slice of a library definition the value layer needs. Kept minimal on
// purpose: the engine should not be able to reach a definition's audience or
// group, because neither may ever affect a computation.
export type AttributeMeta = {
  uuid: string;
  label: string;
  type: SpecificationType;
  unit: string | null;
  ordered: boolean;
  options: SpecOption[];
};

export type AttributeIndex = Map<string, AttributeMeta>;

export const indexAttributes = (
  attributes: AttributeMeta[],
): AttributeIndex => new Map(attributes.map((meta) => [meta.uuid, meta]));

/** Round to 2dp — money-and-watts precision, applied at every boundary. */
export const round2 = (value: number): number =>
  Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Presence of a value
// ---------------------------------------------------------------------------

/**
 * Whether a product actually carries a value for this attribute.
 *
 * The distinction matters more than it looks: a rule only fires on items that
 * carry its attribute, so "absent" and "zero" must never be confused. A camera
 * with a blank power draw has to be reported as UNKNOWN, not silently counted
 * as 0 W and waved through.
 */
export const hasValue = (raw: ProductValue | undefined): boolean => {
  if (raw === undefined || raw === null) {
    return false;
  }
  if (Array.isArray(raw)) {
    return raw.length > 0;
  }
  if (typeof raw === "string") {
    return raw.trim().length > 0;
  }
  // 0 and false are real answers.
  return true;
};

export const readValue = (
  values: ProductValues,
  attrUuid: string,
): ProductValue | undefined => {
  const raw = values[attrUuid];
  return hasValue(raw) ? raw : undefined;
};

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

/**
 * A value as a list of option values, for the set operators.
 *
 * A single-select yields one entry, a multi-select yields its ticked entries,
 * and a boolean yields "true"/"false" so a predicate can name it without the
 * caller special-casing the type.
 */
export const asOptionList = (raw: ProductValue | undefined): string[] => {
  if (!hasValue(raw) || raw === undefined) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  return [String(raw)];
};

/**
 * A value as a number, for arithmetic and the numeric comparators.
 *
 * On a `number` attribute this is the stored number. On an ORDERED select it is
 * the option's `rank` — which is what makes "PoE input at most 802.3at" a real
 * comparison on a dropdown. On an unordered select there is no magnitude, so
 * this returns null rather than inventing one from list position.
 *
 * A multi-select resolves to its highest-ranked ticked option: a device that
 * accepts af/at/bt supplies bt, which is the useful reading for a provider.
 */
export const asNumber = (
  raw: ProductValue | undefined,
  meta: AttributeMeta,
): number | null => {
  if (!hasValue(raw) || raw === undefined) {
    return null;
  }
  if (meta.type === "number") {
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (meta.type === "boolean") {
    return raw === true || raw === "true" ? 1 : 0;
  }
  if (!meta.ordered) {
    return null;
  }
  const ranks = asOptionList(raw)
    .map((value) => optionRank(meta, value))
    .filter((rank): rank is number => rank !== null);
  if (ranks.length === 0) {
    return null;
  }
  return Math.max(...ranks);
};

/** An option's position on the scale, or null when it has none. */
export const optionRank = (
  meta: AttributeMeta,
  value: string,
): number | null => {
  const option = meta.options.find((entry) => entry.value === value);
  if (!option || option.rank === null) {
    return null;
  }
  return option.rank;
};

export const asBoolean = (raw: ProductValue | undefined): boolean | null => {
  if (!hasValue(raw) || raw === undefined) {
    return null;
  }
  if (typeof raw === "boolean") {
    return raw;
  }
  const text = String(raw).trim().toLowerCase();
  if (text === "true" || text === "yes") {
    return true;
  }
  if (text === "false" || text === "no") {
    return false;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Unit safety
// ---------------------------------------------------------------------------

export type UnitConversion =
  | { ok: true; factor: number }
  // The two sides cannot be compared. Reported, never silently coerced: a rule
  // that sums watts against kilowatts approves a 1000x overload and calls it a
  // pass, which is worse than not running at all.
  | { ok: false; reason: string };

/**
 * The factor that converts a value in `from` into `to`, or a refusal.
 *
 * Same unit is always fine. Two units of the same dimension convert. Two units
 * of different dimensions never do — including VA and W, which is deliberate:
 * 1500 VA is not 1500 W, and letting them convert is the classic UPS sizing
 * mistake. An unlisted unit is dimensionless and may only meet itself.
 */
export const unitFactor = (
  from: string | null,
  to: string | null,
): UnitConversion => {
  const left = from?.trim() || null;
  const right = to?.trim() || null;

  if (left === right) {
    return { ok: true, factor: 1 };
  }
  // One side carries a unit and the other does not. A count compared against a
  // count is the normal case for Count rules, so an absent unit on BOTH sides is
  // fine, but absent-vs-present means somebody forgot to fill one in.
  if (!left || !right) {
    return {
      ok: false,
      reason: `one side is measured in ${left ?? right} and the other has no unit`,
    };
  }

  const fromDimension = UNIT_DIMENSIONS[left as keyof typeof UNIT_DIMENSIONS];
  const toDimension = UNIT_DIMENSIONS[right as keyof typeof UNIT_DIMENSIONS];
  if (!fromDimension || !toDimension) {
    return {
      ok: false,
      reason: `${left} and ${right} are not convertible`,
    };
  }
  if (fromDimension.dimension !== toDimension.dimension) {
    return {
      ok: false,
      reason: `${left} measures ${fromDimension.dimension} but ${right} measures ${toDimension.dimension}`,
    };
  }
  return { ok: true, factor: fromDimension.toBase / toDimension.toBase };
};

/** Convert a value from one unit to another, or null when they don't convert. */
export const convert = (
  value: number,
  from: string | null,
  to: string | null,
): number | null => {
  const conversion = unitFactor(from, to);
  if (!conversion.ok) {
    return null;
  }
  return round2(value * conversion.factor);
};

export const formatValue = (value: number, unit: string | null): string =>
  unit ? `${round2(value)} ${unit}` : `${round2(value)}`;

/** An option's display label, falling back to its stable value. */
export const optionLabel = (meta: AttributeMeta, value: string): string =>
  meta.options.find((entry) => entry.value === value)?.label ?? value;

/**
 * A value rendered for a human — option labels rather than stored values, and
 * the unit appended to a number. Findings read much better for it.
 */
export const describeValue = (
  raw: ProductValue | undefined,
  meta: AttributeMeta,
): string => {
  if (!hasValue(raw) || raw === undefined) {
    return "—";
  }
  if (meta.type === "number") {
    return formatValue(Number(raw), meta.unit);
  }
  if (meta.type === "boolean") {
    return asBoolean(raw) ? "Yes" : "No";
  }
  return asOptionList(raw)
    .map((value) => optionLabel(meta, value))
    .join(", ");
};
