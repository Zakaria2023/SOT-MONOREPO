import { UNIT_DIMENSIONS, type SpecificationType } from "../../../db/enum";
import {
  duplicateGroupRows,
  isSpecGroupRows,
  isSpecRange,
  type ProductValue,
  type ProductValues,
  type SpecGroupField,
  type SpecGroupRow,
  type SpecOption,
  type SpecRange,
} from "../../../db/types";

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
  // Only populated for `group`, absent on every other type.
  //
  // Optional deliberately. Requiring it would force ~20 call sites to type
  // `groupFields: []`, which is exactly as wrong for a group attribute as
  // omitting it — so the ceremony buys nothing. The real guarantee is that a
  // `group` attribute cannot be SAVED without sub-fields (see
  // specification-library), backed by readers here that return null or an empty
  // list rather than a plausible 0.
  groupFields?: SpecGroupField[];
};

/** A meta's group schema, treating absent and empty as the same thing. */
const schemaOf = (meta: AttributeMeta): SpecGroupField[] =>
  meta.groupFields ?? [];

// Deliberately NOT here: `allowRange`. Every reader below decides a value is a
// span by its SHAPE, so nothing in a computation needs the flag — and a value
// that is a range stays read as one even if an author later turned the flag off.
// The flag belongs to the authoring surfaces, which is where it lives.

// Which end of a span to read.
//
// Not a preference — the two ends mean different things and picking the wrong
// one is silently unsafe. A span that CONSUMES has to be budgeted at its worst
// case (a 4–12 W camera can draw 12), and a span that SUPPLIES may only promise
// what it always delivers (a 20–30 W port budget guarantees 20).
export type RangeBound = "max" | "min";

export type AttributeIndex = Map<string, AttributeMeta>;

export const indexAttributes = (attributes: AttributeMeta[]): AttributeIndex =>
  new Map(attributes.map((meta) => [meta.uuid, meta]));

/** Round to 2dp — money-and-watts precision, applied at every boundary. */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

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
    // A group's rows are objects, a multi-select's entries are strings. A list
    // holding any object has to be a WELL-FORMED row list to count as answered:
    // a malformed row is unreadable, not absent, and the two must not collapse
    // into each other — the same distinction `isSpecRange` draws for a span.
    if (raw.some((entry) => typeof entry === "object" && entry !== null)) {
      return isSpecGroupRows(raw);
    }
    return raw.length > 0;
  }
  if (typeof raw === "string") {
    return raw.trim().length > 0;
  }
  // An object is only a value if it is a well-formed range. A half-filled
  // {min: 4} would otherwise read as present and then be unreadable, which is
  // the exact confusion between "absent" and "unreadable" this guards.
  if (typeof raw === "object") {
    return isSpecRange(raw);
  }
  // 0 and false are real answers.
  return true;
};

/** A value as a span, or null when it is not one. */
export const asRange = (raw: ProductValue | undefined): SpecRange | null =>
  isSpecRange(raw) ? raw : null;

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
  // Group rows are checked BEFORE the array branch: they are an array too, and
  // `map(String)` would hand the set operators "[object Object]" to match on.
  // Which sub-field a caller means is a question only it can answer — see
  // `groupPicks`.
  if (isSpecGroupRows(raw)) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  // A span is a quantity, not a set membership. Stringifying it would give the
  // set operators an option value of "[object Object]" to match against.
  if (isSpecRange(raw)) {
    return [];
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
 *
 * A SPAN collapses to the end named by `bound`, and the caller must name it —
 * see RangeBound. The default is "max" because every reader that does not know
 * which side it is on is safer over-counting demand than over-promising supply.
 */
export const asNumber = (
  raw: ProductValue | undefined,
  meta: AttributeMeta,
  bound: RangeBound = "max",
): number | null => {
  if (!hasValue(raw) || raw === undefined) {
    return null;
  }
  const range = asRange(raw);
  if (range) {
    return bound === "min" ? range.min : range.max;
  }
  // A group is a LIST of rows, so it has no single magnitude. WHICH sub-field to
  // total is a decision only the caller can make, so it has to name one — see
  // `groupTotal`. Collapsing to something plausible here is the dangerous move:
  // a row count would make "how many ports" read 4 (the number of groups) rather
  // than 50 (the sum of their counts), and nothing would report the difference.
  if (isSpecGroupRows(raw)) {
    return null;
  }
  if (meta.type === "number") {
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (meta.type === "boolean") {
    return raw === true || raw === "true" ? 1 : 0;
  }
  // Prose has no magnitude, and the danger is that some of it PARSES. "48" typed
  // into a mounting note is a perfectly good Number(), so falling through would
  // let a free-text field feed arithmetic for exactly the products whose note
  // happened to start with a digit — a rule that runs on some items and not
  // others, with nothing to say which. Authoring already refuses text as an
  // operand; this is the floor under that refusal.
  if (meta.type === "text") {
    return null;
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
// Group values
// ---------------------------------------------------------------------------

/** A value as a list of group rows, or an empty list when it is not one. */
export const asGroupRows = (raw: ProductValue | undefined): SpecGroupRow[] =>
  isSpecGroupRows(raw) ? raw : [];

/**
 * One named sub-field of a group, or null.
 *
 * The single lookup every caller that names a sub-field goes through — the engine
 * for an operand's unit and label, the authoring validation for whether the
 * sub-field can be summed at all.
 */
export const groupSubField = (
  meta: AttributeMeta,
  fieldKey: string,
): SpecGroupField | null =>
  schemaOf(meta).find((field) => field.key === fieldKey) ?? null;

/**
 * The sub-field an author must fill for a row to mean anything.
 *
 * A row missing any of its schema's sub-fields is DROPPED by the readers below
 * rather than treated as a zero. Half a port group — a count with no speed — is
 * the same failure as a half-filled span: it reads as an answer, and then no
 * comparator can act on it.
 */
export const isCompleteGroupRow = (
  row: SpecGroupRow,
  fields: SpecGroupField[],
): boolean =>
  fields.every((field) => {
    const entry = row[field.key];
    if (field.kind === "number") {
      return typeof entry === "number" && Number.isFinite(entry);
    }
    if (typeof entry !== "string" || entry.trim().length === 0) {
      return false;
    }
    // A pick the sub-field's list does not contain cannot be ranked, matched or
    // rendered as anything but itself — it is unreadable in exactly the way a
    // blank is, so it is treated the same.
    //
    // An EMPTY list is the exception and is deliberately permissive: a sub-field
    // whose shared vocabulary has gone missing resolves to no options, and
    // dropping every row then would make a switch read as having no ports. The
    // count in those rows is still perfectly readable; only the pick is not, and
    // `groupFieldRank` already returns null for it.
    if (field.options.length === 0) {
      return true;
    }
    return field.options.some((option) => option.value === entry);
  });

// Why one authored row is not readable. Enough to name the row, the column and
// the value, because "this product's ports are unreadable" is not actionable and
// "row 2's speed says 40g, which is not on the list" is.
export type GroupRowIssue = {
  // 1-based, as an author counts rows on the form.
  row: number;
  fieldKey: string;
  fieldLabel: string;
  problem: "missing" | "unknown_value" | "duplicate";
  // Only on unknown_value and duplicate.
  value?: string;
};

/**
 * Every reason a group's stored rows fall short of the CURRENT schema.
 *
 * This is what stops the most dangerous edit in the model from being silent.
 * Adding a sub-field to a group that already holds rows makes every one of those
 * rows incomplete — and the readers DROP incomplete rows, so a switch with four
 * port groups quietly starts reading as having no ports at all, which looks
 * exactly like a switch that passed its port check.
 *
 * `hasValue` cannot see this: it only knows the rows are well-formed objects, not
 * whether they answer the schema the attribute has today. So completeness asks
 * here instead.
 */
export const groupRowIssues = (
  raw: ProductValue | undefined,
  meta: AttributeMeta,
): GroupRowIssue[] => {
  const fields = schemaOf(meta);
  if (fields.length === 0) {
    return [];
  }
  const issues: GroupRowIssue[] = [];
  asGroupRows(raw).forEach((row, index) => {
    for (const field of fields) {
      const entry = row[field.key];
      const shared = {
        row: index + 1,
        fieldKey: field.key,
        fieldLabel: field.label,
      };
      if (field.kind === "number") {
        if (typeof entry !== "number" || !Number.isFinite(entry)) {
          issues.push({ ...shared, problem: "missing" });
        }
        continue;
      }
      if (typeof entry !== "string" || entry.trim().length === 0) {
        issues.push({ ...shared, problem: "missing" });
        continue;
      }
      if (
        field.options.length > 0 &&
        !field.options.some((option) => option.value === entry)
      ) {
        issues.push({ ...shared, problem: "unknown_value", value: entry });
      }
    }
  });

  // A DISCRIMINATOR column answered twice.
  //
  // Reported after the per-row pass because it is the only defect that is not
  // visible from inside a single row — two rows each saying `when = maximum` are
  // both perfectly well-formed, and it is the pair that is wrong.
  //
  // It matters because an operand reading a group column TOTALS it: `where:
  // when = maximum` over two maximum rows sums them, so a 12 W camera becomes a
  // 24 W one and every budget check downstream is computed off a number nobody
  // can trace back to anything on the datasheet.
  //
  // Through the SAME `duplicateGroupRows` the product form calls, so what an
  // author is warned about while typing and what the engine reports afterwards
  // are one definition rather than two that drift.
  for (const field of fields) {
    for (const clash of duplicateGroupRows(asGroupRows(raw), field)) {
      issues.push({
        row: clash.index + 1,
        fieldKey: field.key,
        fieldLabel: field.label,
        problem: "duplicate",
        value: clash.value,
      });
    }
  }
  return issues;
};

/** Only the rows a comparator can actually read. */
export const completeGroupRows = (
  raw: ProductValue | undefined,
  meta: AttributeMeta,
): SpecGroupRow[] =>
  asGroupRows(raw).filter((row) => isCompleteGroupRow(row, schemaOf(meta)));

/**
 * Total a numeric sub-field across every complete row.
 *
 * This is what "how many 10G ports does this switch have" reduces to once the
 * caller has narrowed the rows. Returns null when the attribute has no such
 * numeric sub-field, because 0 would be indistinguishable from a real total of
 * zero and one of those two is a configuration error.
 */
export const groupTotal = (
  raw: ProductValue | undefined,
  meta: AttributeMeta,
  fieldKey: string,
): number | null => {
  const rows = completeGroupRows(raw, meta);
  // No readable rows is UNANSWERED, and must not read as a total of zero: a
  // switch whose ports became unreadable would otherwise measure "0 ports" and
  // pass a rule it should have failed. A caller narrowing rows itself decides
  // that question for itself — see `columnTotal`.
  if (rows.length === 0) {
    return null;
  }
  return columnTotal(rows, meta, fieldKey);
};

/**
 * Σ of a numeric column over exactly the rows given.
 *
 * Split out from `groupTotal` so a caller that has already narrowed the rows —
 * "only the 10G ones" — shares the same reduction rather than writing a second
 * one. Null means the column is not a count at all, which is a configuration
 * error; an empty list of rows sums to a genuine 0, and reading that as "unknown"
 * is exactly what stops a rule failing a product it should fail.
 */
export const columnTotal = (
  rows: SpecGroupRow[],
  meta: AttributeMeta,
  fieldKey: string,
): number | null => {
  const field = schemaOf(meta).find((entry) => entry.key === fieldKey);
  if (!field || field.kind !== "number") {
    return null;
  }
  return round2(
    rows.reduce((sum, row) => {
      const entry = row[fieldKey];
      return sum + (typeof entry === "number" ? entry : 0);
    }, 0),
  );
};

/** The distinct picks of a select column over exactly the rows given. */
export const columnPicks = (
  rows: SpecGroupRow[],
  meta: AttributeMeta,
  fieldKey: string,
): string[] => {
  const field = schemaOf(meta).find((entry) => entry.key === fieldKey);
  if (!field || field.kind !== "select") {
    return [];
  }
  const seen = new Set<string>();
  for (const row of rows) {
    const entry = row[fieldKey];
    if (typeof entry === "string") {
      seen.add(entry);
    }
  }
  return [...seen];
};

/**
 * Every distinct option a select sub-field holds across the rows.
 *
 * The set-membership reading of a group: "does this switch have any SFP cage at
 * all" is `groupPicks(...).includes("sfp")`. Deduplicated and in row order, so
 * the answer does not change when an author reorders rows.
 */
export const groupPicks = (
  raw: ProductValue | undefined,
  meta: AttributeMeta,
  fieldKey: string,
): string[] => columnPicks(completeGroupRows(raw, meta), meta, fieldKey);

/**
 * Coerce authored rows into storable ones. The one place that decides what a
 * group value MEANS on the way in.
 *
 * Pure, and here rather than beside the save path, because the save path opens a
 * database connection and this is the part worth testing on its own.
 *
 *  - Anything the schema does not name is DROPPED. A stored key nothing describes
 *    is data no reader will ever look at again.
 *  - Each entry is coerced to its sub-field's kind, so a count arriving as the
 *    string "24" becomes 24 — every reader above does arithmetic on it without
 *    re-parsing.
 *  - A pick the sub-field's list does not contain is REFUSED, so a row can never
 *    be stored holding a value no comparator could read. This is the same check
 *    `isCompleteGroupRow` applies on the way out; doing it in both directions is
 *    what stops the two from disagreeing about which rows exist.
 *  - An INCOMPLETE row is dropped rather than half-stored, exactly as a
 *    half-filled span is. The readers ignore it either way, so storing one would
 *    show the author an answer that no rule can see.
 */
export type NormalizedGroupRows = {
  rows: SpecGroupRow[];
  // Rows that held SOMETHING and still could not be stored.
  //
  // The distinction this draws is the whole point. A row with nothing in it at
  // all is an abandoned "Add row" click and is dropped in silence — refusing a
  // save over it would block an author who clicked once too often. A row with
  // some columns answered and some blank is data somebody typed, and dropping
  // that silently is how four slot systems become three with no message.
  rejected: GroupRowIssue[];
};

export const normalizeGroupRows = (
  value: unknown,
  fields: SpecGroupField[],
): NormalizedGroupRows => {
  if (fields.length === 0 || !Array.isArray(value)) {
    return { rows: [], rejected: [] };
  }
  const cleaned: SpecGroupRow[] = [];
  const rejected: GroupRowIssue[] = [];

  value.forEach((row, index) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return;
    }
    const entries: Record<string, unknown> = row;
    const next: SpecGroupRow = {};
    const issues: GroupRowIssue[] = [];
    // Whether the author put anything in this row at all — what tells an
    // abandoned row apart from a half-finished one.
    let answered = 0;

    for (const field of fields) {
      const entry = entries[field.key];
      const shared = {
        row: index + 1,
        fieldKey: field.key,
        fieldLabel: field.label,
      };

      if (field.kind === "number") {
        const blank = entry === undefined || entry === null || entry === "";
        const parsed = typeof entry === "number" ? entry : Number(entry);
        if (blank || !Number.isFinite(parsed)) {
          // A number that was typed but is not a number ("abc") counts as
          // answered: the author meant to fill it in and got it wrong, which is
          // exactly the case worth telling them about.
          if (!blank) {
            answered += 1;
          }
          issues.push({ ...shared, problem: "missing" });
          continue;
        }
        answered += 1;
        next[field.key] = parsed;
        continue;
      }

      const text = typeof entry === "string" ? entry.trim() : "";
      if (text === "") {
        issues.push({ ...shared, problem: "missing" });
        continue;
      }
      answered += 1;
      // Membership, on the same terms as `isCompleteGroupRow` — including its
      // exception for a list that resolved to nothing, so a missing shared
      // vocabulary does not erase rows an author entered correctly.
      if (
        field.options.length > 0 &&
        !field.options.some((option) => option.value === text)
      ) {
        issues.push({ ...shared, problem: "unknown_value", value: text });
        continue;
      }
      next[field.key] = text;
    }

    if (issues.length === 0) {
      cleaned.push(next);
      return;
    }
    if (answered > 0) {
      rejected.push(...issues);
    }
  });

  return { rows: cleaned, rejected };
};

/** A group sub-field's option rank, for the ordered comparators. */
export const groupFieldRank = (
  field: SpecGroupField,
  value: string,
): number | null => {
  if (!field.ordered) {
    return null;
  }
  const option = field.options.find((entry) => entry.value === value);
  return option && option.rank !== null ? option.rank : null;
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
  const range = asRange(raw);
  if (range) {
    // One unit, at the end — "4 to 12 W", not "4 W to 12 W".
    return `${round2(range.min)} to ${formatValue(range.max, meta.unit)}`;
  }
  // Rows in schema order, so "24 × 1G BASE-T" reads the way the author entered
  // it. Option LABELS, not stored values, for the same reason the select branch
  // below resolves them — a finding that says "base-t" helps nobody.
  if (isSpecGroupRows(raw)) {
    return (
      asGroupRows(raw)
        .map((row) =>
          schemaOf(meta)
            .map((field) => {
              const entry = row[field.key];
              if (entry === undefined) {
                return "—";
              }
              if (field.kind === "number") {
                return formatValue(Number(entry), field.unit);
              }
              const option = field.options.find(
                (candidate) => candidate.value === entry,
              );
              return option?.label ?? String(entry);
            })
            .join(" · "),
        )
        .join(", ") || "—"
    );
  }
  if (meta.type === "number") {
    return formatValue(Number(raw), meta.unit);
  }
  if (meta.type === "boolean") {
    return asBoolean(raw) ? "Yes" : "No";
  }
  // Prose, shown as written. Not run through `optionLabel` — a text attribute has
  // no options, so the lookup would miss and return the same string, but only by
  // accident. Said explicitly so it stays true if that fallback ever changes.
  if (meta.type === "text") {
    return String(raw);
  }
  return asOptionList(raw)
    .map((value) => optionLabel(meta, value))
    .join(", ");
};
