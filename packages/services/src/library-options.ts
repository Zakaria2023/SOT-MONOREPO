import { slugify } from "utils";
import type { SpecGroupField, SpecOption } from "../../../db/types";

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
    merged.push({
      key,
      label: entry.label.trim(),
      kind: entry.kind,
      // Each normalised to its own kind, exactly as the attribute-level
      // `ordered`/`allowRange` are: a select carrying a unit, or a count carrying
      // an option list, leaves the row editor with no honest control to render.
      unit: isSelect ? null : entry.unit?.trim() || null,
      ordered: isSelect ? entry.ordered : false,
      options: isSelect
        ? mergeOptions(
            storedByKey.get(key)?.options ?? [],
            entry.options,
            entry.ordered,
          )
        : [],
    });
  });

  return merged;
};
