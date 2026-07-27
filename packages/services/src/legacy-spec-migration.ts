import type { SpecificationType } from "../../../db/enum";
import type { ProductValue, SpecOption } from "../../../db/types";

// ---------------------------------------------------------------------------
// The one-way transformations that carry the OLD specification model into the
// new one. Pure, and tested — because a mistake here silently rewrites every
// attribute and every product value in the library, and the result would look
// like valid data rather than an error.
//
// Used by db/prepare-spec-model.ts (schema + definitions) and
// db/migrate-spec-model.ts (product values). Deliberately not exported from the
// package index: this is migration code with a finite life, not part of the
// model.
// ---------------------------------------------------------------------------

// What the old table recorded. The type was spread across three columns and an
// option list, which is exactly why it is one column now.
export type LegacySpec = {
  label: string;
  valueType: string | null;
  inputType: string | null;
  allowMultiple: boolean;
  allowRange: boolean;
  ordered: boolean;
  options: LegacyOption[];
};

export type LegacyOption = {
  value?: unknown;
  label?: unknown;
  rank?: unknown;
  retired?: unknown;
};

export type DerivedType = {
  type: SpecificationType;
  // Set when the row cannot be carried across faithfully and a human has to
  // look. Reported by the script rather than resolved silently.
  note?: string;
};

/**
 * The new single type, derived from the columns that used to encode it between
 * them.
 *
 * `text` has no equivalent — free text can feed neither a rule nor a filter,
 * which is why the type was dropped. Those rows land as `single_select` and are
 * flagged, so somebody decides whether they belong in the library at all rather
 * than discovering an unusable field later.
 */
export const deriveSpecificationType = (spec: LegacySpec): DerivedType => {
  const input = (spec.inputType ?? "").trim();
  if (
    input === "number" ||
    input === "boolean" ||
    input === "single_select" ||
    input === "multi_select"
  ) {
    return { type: input };
  }
  if (input === "text") {
    return {
      type: "single_select",
      note: "was free text — free text cannot feed a rule, so review whether it belongs in the library",
    };
  }

  // An older row with no inputType: fall back to the engine-facing columns, the
  // same way the old resolver did, so the behaviour matches what was live.
  if (spec.valueType === "number") {
    return { type: "number" };
  }

  const values = spec.options.map((option) => String(option.value ?? ""));
  const isYesNo =
    values.length === 2 && values.includes("Yes") && values.includes("No");
  if (isYesNo) {
    return { type: "boolean" };
  }
  if (spec.allowMultiple) {
    return { type: "multi_select" };
  }
  if (values.length === 0) {
    return {
      type: "single_select",
      note: "had no options and no recorded type — review it",
    };
  }
  return { type: "single_select" };
};

/**
 * Reshape an option list, preserving each option's IDENTITY.
 *
 * `value` is carried across untouched: it is what every product's stored value
 * points at, so changing it would orphan exactly the data this migration exists
 * to protect. The label starts as the old value — which is what the admin was
 * already displaying — and is free to be edited afterwards.
 *
 * A rank is assigned only when the attribute is a scale, and it follows the
 * author's existing order, because list position is what the old comparators
 * read. So the meaning is preserved rather than invented.
 *
 * Number and boolean attributes get no options: a boolean is a real true/false
 * now, not a two-option select of the strings "Yes" and "No".
 */
export const reshapeOptions = (
  spec: LegacySpec,
  type: SpecificationType,
): SpecOption[] => {
  if (type === "number" || type === "boolean") {
    return [];
  }
  return spec.options.flatMap((option, index) => {
    const value = String(option.value ?? "").trim();
    if (value === "") {
      return [];
    }
    const label =
      typeof option.label === "string" && option.label.trim() !== ""
        ? option.label
        : value;
    const existingRank =
      typeof option.rank === "number" && Number.isFinite(option.rank)
        ? option.rank
        : null;
    return [
      {
        value,
        label,
        rank: spec.ordered ? (existingRank ?? index + 1) : null,
        retired: option.retired === true,
      },
    ];
  });
};

/** The old encoding of a multi-select value: "802.3af, 802.3at". */
export const splitLegacyValues = (raw: string): string[] =>
  raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");

/**
 * Match a legacy stored value onto an option's stable `value`.
 *
 * Old rows stored the displayed LABEL, so the match is tried against the value,
 * then the label, then case-insensitively against both — a hand-built catalog is
 * never consistent, and a near-miss here means a silently dropped value.
 */
export const matchLegacyOption = (
  options: SpecOption[],
  raw: string,
): SpecOption | undefined => {
  const needle = raw.trim();
  const lower = needle.toLowerCase();
  return (
    options.find((option) => option.value === needle) ??
    options.find((option) => option.label === needle) ??
    options.find((option) => option.label.toLowerCase() === lower) ??
    options.find((option) => option.value.toLowerCase() === lower)
  );
};

export type ConvertedValue =
  | { ok: true; value: ProductValue }
  // Reported and left unset, never guessed. A wrong number in a budget rule is
  // worse than a missing one, because a missing one is visible as incomplete.
  | { ok: false; reason: string };

/**
 * Convert one stored string value into its typed form.
 *
 * The old model stored everything as a string, including ranges ("220 - 240").
 * Ranges are gone; the WORST case is kept, because that is what a budget check
 * needs and quietly halving a demand figure is the dangerous direction to err in.
 */
export const convertLegacyValue = (
  raw: string,
  type: SpecificationType,
  options: SpecOption[],
): ConvertedValue => {
  const value = raw.trim();
  if (value === "") {
    return { ok: false, reason: "empty" };
  }

  if (type === "number") {
    const rangeAt = value.indexOf(" - ");
    const candidate =
      rangeAt === -1 ? value : value.slice(rangeAt + 3).trim() || value;
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) {
      return { ok: false, reason: `"${raw}" is not a number` };
    }
    return { ok: true, value: parsed };
  }

  if (type === "boolean") {
    const lower = value.toLowerCase();
    if (lower === "yes" || lower === "true") {
      return { ok: true, value: true };
    }
    if (lower === "no" || lower === "false") {
      return { ok: true, value: false };
    }
    return { ok: false, reason: `"${raw}" is not a yes/no value` };
  }

  const parts = splitLegacyValues(value);
  const matched = parts.flatMap((part) => {
    const option = matchLegacyOption(options, part);
    return option ? [option.value] : [];
  });
  const unmatched = parts.filter(
    (part) => matchLegacyOption(options, part) === undefined,
  );

  if (matched.length === 0) {
    return {
      ok: false,
      reason: `no option matches ${unmatched.map((part) => `"${part}"`).join(", ")}`,
    };
  }
  if (type === "multi_select") {
    return { ok: true, value: matched };
  }
  const first = matched[0];
  if (first === undefined) {
    return { ok: false, reason: `no option matches "${raw}"` };
  }
  return { ok: true, value: first };
};
