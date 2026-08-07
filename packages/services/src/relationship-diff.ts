import type { RelationshipSnapshot } from "../../../db/types";

// ---------------------------------------------------------------------------
// WHAT CHANGED BETWEEN TWO VERSIONS OF A RULE.
//
// The audit trail diffs three scalar fields. The fields somebody actually
// breaks — the operands, the side filters, the lookup table, the presence spec —
// are nested JSON, and they were not compared at all. "Who broke this rule?" was
// answerable; "and what did they do to it?" was not.
//
// Nested values are compared by their JSON text rather than field by field. It
// is deliberately coarse: the useful answer at this level is "the consumer side
// changed", and unfolding a predicate tree into a per-node diff produces a
// report longer than the rule it describes. The two versions are both on screen
// for anyone who wants the detail.
//
// Key order is the one risk in comparing JSON text, and it is not a real one
// here: both sides come from the same writer, which builds every snapshot from
// the same object literal.
// ---------------------------------------------------------------------------

export type FieldChange = {
  field: keyof RelationshipSnapshot;
  // A short human reading of each side — "802.3at", "3 rows", "—". The full
  // values are on the versions themselves.
  from: string;
  to: string;
};

const FIELD_ORDER: (keyof RelationshipSnapshot)[] = [
  "name",
  "description",
  "family",
  "gate",
  "comparator",
  "matchMode",
  "headroomPercent",
  "ratioLimit",
  "allocation",
  "perItem",
  "consumer",
  "provider",
  "consumerWhen",
  "providerWhen",
  "lookup",
  "presence",
  "scope",
];

/**
 * A value in as few words as a table cell allows.
 *
 * Structured values are counted rather than rendered: "a predicate" tells the
 * reader which field to go and look at, which is all a diff row can usefully do
 * for a tree.
 */
export const describeSnapshotValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.rows)) {
      return `${record.rows.length} row${record.rows.length === 1 ? "" : "s"}`;
    }
    if (Array.isArray(record.requires)) {
      return `${record.requires.length} requirement${
        record.requires.length === 1 ? "" : "s"
      }`;
    }
    if (typeof record.source === "string") {
      return `a ${record.source}`;
    }
    if (typeof record.op === "string") {
      return `a condition`;
    }
    return "set";
  }
  return String(value);
};

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }
  // Both absent, spelled differently. A rule saved with `null` and one saved
  // with the key missing are the same rule, and reporting that as a change
  // would put a row in every diff forever.
  if (
    (a === null || a === undefined) &&
    (b === null || b === undefined)
  ) {
    return true;
  }
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
};

/** Every authored field that differs, in the order the form presents them. */
export const diffSnapshots = (
  before: RelationshipSnapshot,
  after: RelationshipSnapshot,
): FieldChange[] =>
  FIELD_ORDER.filter((field) => !sameValue(before[field], after[field])).map(
    (field) => ({
      field,
      from: describeSnapshotValue(before[field]),
      to: describeSnapshotValue(after[field]),
    }),
  );
