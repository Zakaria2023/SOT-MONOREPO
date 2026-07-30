import { slugify } from "utils";
import {
  isSpecGroupRows,
  type ProductValue,
  type SpecGroupField,
  type SpecOption,
} from "../../../db/types";

// ---------------------------------------------------------------------------
// Option identity. Pure — no database, so it is testable on its own.
//
// It lives apart from `specification-library` for exactly that reason: that
// module opens a connection the moment it is imported, and this is the one piece
// of it that decides what a stored value MEANS. Rules compare these values
// across categories and products hold them for years, so a mistake here is not a
// display bug — it is two different things becoming the same thing.
// ---------------------------------------------------------------------------

export type LibraryOptionInput = {
  // Present on an option that already exists. Absent on one the author just
  // typed, which is what makes it a candidate for a derived value.
  value?: string;
  label: string;
  rank: number | null;
};

/**
 * Normalise an author's option list against what is already stored.
 *
 * Options are APPEND-ONLY. An option that disappears from the input is marked
 * `retired` rather than removed, because deleting it would leave every product
 * holding that value pointing at something that no longer exists — and those
 * products would then silently drop out of any rule reading the attribute.
 *
 * A retired option that comes back is simply un-retired, keeping its identity so
 * historical values line up again.
 */
export const mergeOptions = (
  existing: SpecOption[],
  input: LibraryOptionInput[],
  ordered: boolean,
): SpecOption[] => {
  const usable = input.filter((entry) => entry.label.trim() !== "");

  // A value is the identity a product stores and a rule compares, so it has to
  // be unique within the attribute. Deriving it from the label is a convenience,
  // and the derivation is LOSSY: `slugify` strips everything that is not a
  // letter or a digit, so "PoE", "PoE+" and "PoE++" all reduce to "poe".
  //
  // The collision used to be dropped — the author typed a second option, saved,
  // and it simply was not there, with no error and nothing to look at.
  //
  // TWO PASSES, and the order matters. Every value an option ALREADY carries is
  // claimed first, because products point at those; only then are new options
  // given a value, around what is taken. One pass in list order would let a new
  // "PoE+" sitting above the existing "PoE" take "poe" for itself — and every
  // product holding "poe" would silently start reading as PoE+.
  const taken = new Set<string>();
  for (const entry of usable) {
    const stored = entry.value?.trim();
    if (stored) {
      taken.add(stored);
    }
  }
  for (const option of existing) {
    // A RETIRED option still owns its value: products may still hold it, and
    // handing it to something else would rewrite what they mean.
    taken.add(option.value);
  }

  const uniqueValue = (base: string): string => {
    if (!taken.has(base)) {
      return base;
    }
    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) {
      suffix += 1;
    }
    return `${base}-${suffix}`;
  };

  const seen = new Set<string>();
  const merged: SpecOption[] = [];

  usable.forEach((entry, index) => {
    const label = entry.label.trim();
    // A stable value is derived once, at creation, and then carried forward by
    // the author's editor. Editing a label never re-derives it.
    const stored = entry.value?.trim();
    if (stored && seen.has(stored)) {
      // The same existing option listed twice. Not a new option needing a value
      // of its own — the duplicate is the mistake, and the first one wins.
      return;
    }
    const value =
      stored || uniqueValue(slugify(label) || `option-${index + 1}`);
    seen.add(value);
    taken.add(value);
    merged.push({
      value,
      label,
      // On an ordered scale every option needs a rank, or the comparators have
      // nothing to compare. Falling back to position is better than null, but
      // the admin asks for it explicitly.
      rank: ordered ? (entry.rank ?? index + 1) : null,
      retired: false,
    });
  });

  for (const option of existing) {
    if (!seen.has(option.value)) {
      merged.push({ ...option, retired: true });
    }
  }
  return merged;
};

// ---------------------------------------------------------------------------
// Shared vocabularies
//
// An attribute, or one sub-field of a group, either owns its option list or
// points at a SET that several of them share. Everything above the library reads
// `options` and `ordered` and must never learn which of the two happened — that
// is what keeps the engine, the facets, the product form and the read model
// unchanged by this whole feature.
//
// So resolution happens exactly ONCE, here, on the way out of the database.
// ---------------------------------------------------------------------------

export type OptionVocabulary = {
  ordered: boolean;
  options: SpecOption[];
};

/** Shared sets by uuid — built once per load, never per attribute. */
export type OptionSetIndex = Map<string, OptionVocabulary>;

export const indexOptionSets = (
  sets: { uuid: string; ordered: boolean; options: SpecOption[] | null }[],
): OptionSetIndex =>
  new Map(
    sets.map((set) => [
      set.uuid,
      { ordered: set.ordered, options: set.options ?? [] },
    ]),
  );

/**
 * The list something actually offers, and whether that list is a scale.
 *
 * A pointer WINS OUTRIGHT over the inline list. Not a merge and not a fallback:
 * two lists for one field is two answers to "what may a product hold", and a
 * union of them would quietly re-admit a value the shared vocabulary had retired.
 *
 * `ordered` comes from the SET when one is named, because whether 1G is smaller
 * than 10G belongs to the words. Reading it from the borrower would let two
 * attributes sharing a list disagree, and a comparison that works one way round
 * and silently returns nothing the other is worse than one that never worked.
 *
 * A pointer at a set that has gone MISSING resolves to an empty list. Deletion is
 * refused while anything points at a set, so this is a hand-edited database or a
 * restore gone wrong — and an attribute that offers nothing is a visible failure
 * an author reports, where falling back to the stale inline list would be an
 * invisible one that hands out values no rule can compare.
 */
export const resolveVocabulary = (
  own: {
    ordered: boolean;
    options: SpecOption[] | null;
    optionSetUuid?: string | null;
  },
  sets: OptionSetIndex,
): OptionVocabulary => {
  if (!own.optionSetUuid) {
    return { ordered: own.ordered, options: own.options ?? [] };
  }
  return sets.get(own.optionSetUuid) ?? { ordered: own.ordered, options: [] };
};

/**
 * A group's sub-fields with every shared list resolved in place.
 *
 * The resolved options are written back into `options`, so `spec-values`,
 * `describeValue`, the row editor and the comparators keep reading one field and
 * never branch on where it came from. `optionSetUuid` is carried through
 * untouched — the authoring form needs to know what the author chose, and
 * dropping it here would silently turn a shared list into an inline copy on the
 * next save.
 */
export const resolveGroupFields = (
  fields: SpecGroupField[],
  sets: OptionSetIndex,
): SpecGroupField[] =>
  fields.map((field) => {
    if (field.kind !== "select" || !field.optionSetUuid) {
      return field;
    }
    const vocabulary = resolveVocabulary(field, sets);
    return {
      ...field,
      ordered: vocabulary.ordered,
      options: vocabulary.options,
    };
  });

// ---------------------------------------------------------------------------
// Re-pointing safely
//
// Moving an attribute from its own list to a shared one rewrites no stored value
// — it changes what those values MEAN. So the question is never "is re-pointing
// allowed", it is the much narrower one these two answer: does the destination
// vocabulary spell every value products are already holding?
//
// If it does, the re-point is a no-op for meaning and perfectly safe — which is
// the normal case, because an author who authors a shared list from an existing
// attribute's options gets the same values back. If it does not, the values that
// would be stranded can be named, which is far more use than a blanket refusal.
// ---------------------------------------------------------------------------

/**
 * Every option value a set of stored product values actually uses.
 *
 * `subFieldKey` narrows to one column of a group's rows; without it, the values
 * are read as an attribute's own answer. Anything that is not option-backed —
 * a number, a span, a boolean — contributes nothing, because re-pointing an
 * option list cannot change what those mean.
 */
export const usedOptionValues = (
  values: ProductValue[],
  subFieldKey?: string,
): string[] => {
  const found = new Set<string>();
  for (const value of values) {
    if (subFieldKey !== undefined) {
      if (!isSpecGroupRows(value)) {
        continue;
      }
      for (const row of value) {
        const entry = row[subFieldKey];
        if (typeof entry === "string" && entry.trim() !== "") {
          found.add(entry);
        }
      }
      continue;
    }
    if (typeof value === "string") {
      found.add(value);
      continue;
    }
    // A multi-select. Group rows are also arrays, so they are excluded first —
    // otherwise every row object would stringify into the set.
    if (Array.isArray(value) && !isSpecGroupRows(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          found.add(entry);
        }
      }
    }
  }
  return [...found];
};

/**
 * The used values a vocabulary cannot spell — the ones a re-point would strand.
 *
 * RETIRED options count as spelled. A product holding a retired value still means
 * exactly what it always meant; retirement only stops the value being picked
 * again, which is the whole reason retiring exists instead of deleting.
 */
export const valuesOutsideVocabulary = (
  used: string[],
  options: SpecOption[],
): string[] => {
  const spelled = new Set(options.map((option) => option.value));
  return used.filter((value) => !spelled.has(value));
};

// ---------------------------------------------------------------------------
// Group sub-fields
// ---------------------------------------------------------------------------

export type LibraryGroupFieldInput = {
  // Present on a sub-field that already exists, absent on one just added — the
  // same signal `LibraryOptionInput.value` carries.
  key?: string;
  label: string;
  kind: "number" | "select";
  unit: string | null;
  ordered: boolean;
  options: LibraryOptionInput[];
  // When set, the picks come from a shared vocabulary and `options`/`ordered` on
  // this input are ignored.
  optionSetUuid?: string | null;
};

/**
 * Normalise a group's sub-field schema against what is already stored.
 *
 * Keys are stable for the same reason option values are: a product's rows are
 * objects keyed by them, so re-deriving a key from a renamed label would orphan
 * every stored row at once. Each sub-field's option list goes through
 * `mergeOptions`, so a group's picks get the same append-only guarantees as a
 * top-level select.
 *
 * TWO HAZARDS this function cannot fix on its own, both belonging to the caller:
 *
 *  - ADDING a sub-field to a group that already holds rows makes every existing
 *    row incomplete, and the readers DROP incomplete rows — so a switch silently
 *    reads as having no ports. Existing rows have to be backfilled, or the edit
 *    refused, before this is safe.
 *  - REMOVING a sub-field is not retirement: unlike an option there is nowhere to
 *    hang a `retired` flag, so the stored rows keep a key nothing reads. Harmless
 *    to read, but it is data the schema no longer describes.
 *  - RE-POINTING a sub-field's option source — inline to shared, or between two
 *    sets — reinterprets every value already stored under that key, because the
 *    new vocabulary spells things its own way. Refused upstream while any product
 *    holds rows for the attribute (see specification-library).
 */
export const mergeGroupFields = (
  existing: SpecGroupField[],
  input: LibraryGroupFieldInput[],
): SpecGroupField[] => {
  const usable = input.filter((entry) => entry.label.trim() !== "");
  const storedByKey = new Map(existing.map((field) => [field.key, field]));

  // Same two-pass claim as `mergeOptions`, and for the same reason: a new
  // sub-field must never take a key an existing one already owns, whatever order
  // the author listed them in.
  const taken = new Set<string>();
  for (const entry of usable) {
    const stored = entry.key?.trim();
    if (stored) {
      taken.add(stored);
    }
  }
  for (const field of existing) {
    taken.add(field.key);
  }

  const uniqueKey = (base: string): string => {
    if (!taken.has(base)) {
      return base;
    }
    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) {
      suffix += 1;
    }
    return `${base}-${suffix}`;
  };

  const seen = new Set<string>();
  const merged: SpecGroupField[] = [];

  usable.forEach((entry, index) => {
    const stored = entry.key?.trim();
    if (stored && seen.has(stored)) {
      // The same sub-field listed twice. The duplicate is the mistake, so the
      // first one wins rather than the second silently claiming a new key.
      return;
    }
    const key =
      stored || uniqueKey(slugify(entry.label) || `field-${index + 1}`);
    seen.add(key);
    taken.add(key);

    const isSelect = entry.kind === "select";
    // A shared vocabulary owns the list and the scale, so nothing is stored here
    // for either. Keeping an inline copy alongside the pointer is the one thing
    // that must not happen: whichever the next reader picked would be a coin toss,
    // and the losing list would drift silently for months.
    const shared = isSelect ? entry.optionSetUuid?.trim() || null : null;
    merged.push({
      key,
      label: entry.label.trim(),
      kind: entry.kind,
      // Each normalised to its own kind, exactly as the attribute-level
      // `ordered`/`allowRange` are: a select carrying a unit, or a count carrying
      // an option list, leaves the row editor with no honest control to render.
      unit: isSelect ? null : entry.unit?.trim() || null,
      ordered: isSelect && !shared ? entry.ordered : false,
      options:
        isSelect && !shared
          ? mergeOptions(
              storedByKey.get(key)?.options ?? [],
              entry.options,
              entry.ordered,
            )
          : [],
      optionSetUuid: shared,
    });
  });

  return merged;
};
