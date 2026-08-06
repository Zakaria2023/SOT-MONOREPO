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
  // Other spellings this option answers to. See SpecOption.aliases.
  aliases?: string[];
};

/**
 * An option's alias list, as it will be stored.
 *
 * Trimmed, de-duplicated, and stripped of any spelling the option ALREADY
 * answers to under its own name — an alias that repeats the label is not wrong,
 * it is noise, and it would show up in every conflict report for the rest of the
 * attribute's life.
 *
 * De-duplication is case-insensitive but the FIRST spelling is what gets stored:
 * aliases are matched case-insensitively, so keeping both "II" and "ii" would be
 * two entries that can never resolve differently. Punctuation is deliberately NOT
 * normalised away here — `||` is a real alias and squashing it would leave an
 * empty string.
 *
 * Empty becomes NULL-equivalent (an empty array), on the same reasoning as
 * `normalizeSetValues`: one representation of "none", not two.
 */
export const normalizeAliases = (
  aliases: string[] | null | undefined,
  own: { value: string; label: string },
): string[] => {
  const excluded = new Set([
    own.value.trim().toLowerCase(),
    own.label.trim().toLowerCase(),
  ]);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of aliases ?? []) {
    const alias = raw.trim();
    if (alias === "") {
      continue;
    }
    const key = alias.toLowerCase();
    if (excluded.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    kept.push(alias);
  }
  return kept;
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
  // Values some product currently holds. When supplied, an option the author
  // removed and NOTHING holds is deleted for real instead of retired.
  //
  // Retiring exists to stop a stored value pointing at a word that no longer
  // exists — it is a refusal, not a filing system. Applied to a value nobody
  // holds it refuses nothing, and the author is left with a list that grows
  // every time they correct a typo and never shrinks.
  //
  // Omitted = retire everything absent, the old behaviour. A caller that has not
  // checked what is held must not be able to delete on a guess.
  held?: ReadonlySet<string>,
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
    const aliases = normalizeAliases(entry.aliases, { value, label });
    merged.push({
      value,
      label,
      // On an ordered scale every option needs a rank, or the comparators have
      // nothing to compare. Falling back to position is better than null, but
      // the admin asks for it explicitly.
      rank: ordered ? (entry.rank ?? index + 1) : null,
      retired: false,
      // OMITTED when empty rather than stored as `[]`. Absent and empty already
      // mean the same thing, and writing `[]` onto every option in the library
      // would rewrite the stored JSON of thousands of options that have no
      // aliases and never will — a diff nobody can read, for no information.
      ...(aliases.length > 0 ? { aliases } : {}),
    });
  });

  for (const option of existing) {
    if (seen.has(option.value)) {
      continue;
    }
    // Safe to lose: no product spells anything with it, so nothing can be left
    // pointing at a word that stopped existing.
    if (held && !held.has(option.value)) {
      continue;
    }
    // Aliases come across UNTOUCHED. A retired option still owns its value and
    // products still hold it, so it has to keep answering to every spelling it
    // ever answered to — otherwise a live option claims one of them and each of
    // those products silently changes meaning.
    merged.push({ ...option, retired: true });
  }
  return merged;
};

// ---------------------------------------------------------------------------
// Near-duplicate options — the collision `mergeOptions` cannot see
//
// `mergeOptions` guards VALUE identity: two options can never end up sharing the
// stored string a product holds. That is the mechanical half. The other half is
// semantic and it is the one that actually happens: an author who cannot find
// "802.3at" adds "PoE+ (802.3at)". Both survive, both are valid, and from then on
// half the catalog says one and half says the other — so every rule keyed on the
// first silently stops matching the products holding the second. Nothing errors,
// and a rule that stops matching looks exactly like a rule nothing violated.
//
// There is no way to be certain two labels mean the same thing, so this never
// refuses. It SURFACES, and the author decides — which is the same call the model
// already makes for a value outside a category's slice.
// ---------------------------------------------------------------------------

// Letters and digits only, lowercased, so punctuation and spacing stop mattering:
// "802.3at", "802-3AT" and "802 3 at" all reduce to the same thing.
const squash = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]/g, "");

// The alphanumeric runs of a label, which is what makes "PoE+ (802.3at)" and
// "802.3at" comparable: one's tokens contain the other's.
const tokens = (text: string): string[] =>
  text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/**
 * Whether two option labels are close enough to be worth a second look.
 *
 * Containment rather than edit distance, deliberately. The real cases are a
 * shorter name inside a longer one — "802.3at" inside "PoE+ (802.3at)", "10G"
 * inside "10 Gbps" — and edit distance rates those as far apart while rating
 * "802.3at" and "802.3af" (genuinely different standards, one character apart) as
 * nearly identical. That is backwards, and being wrong in that direction merges
 * two real values.
 */
export const looksLikeSameOption = (a: string, b: string): boolean => {
  const left = squash(a);
  const right = squash(b);
  if (left === "" || right === "") {
    return false;
  }
  if (left === right) {
    return true;
  }
  // One label's alphanumeric core sits inside the other's. Bounded below so a
  // one- or two-character label does not match half the list: "A" is inside
  // "802.3at" as a substring and means nothing of the sort.
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 3 && longer.includes(shorter)) {
    return true;
  }
  // Or they share a distinctive token — "802" alone is not distinctive, "8023at"
  // is. This is what catches "PoE+ (802.3at)" against "802.3at" once punctuation
  // splits them into separate tokens rather than one run.
  const rightTokens = tokens(b);
  return tokens(a).some(
    (token) => token.length >= 4 && rightTokens.includes(token),
  );
};

/**
 * Existing options an author's new label might be a second name for.
 *
 * Retired options are INCLUDED. A retired option still owns its value and
 * products still hold it, so re-adding it under a new name is the worst version
 * of this mistake: the catalog ends up with two live spellings of one thing and
 * the older products are the ones that fall out of every rule.
 */
export const similarOptions = (
  label: string,
  existing: SpecOption[],
): SpecOption[] =>
  existing.filter((option) => looksLikeSameOption(label, option.label));

// ---------------------------------------------------------------------------
// Resolving a written form onto an option — the importer's front door
//
// `similarOptions` SURFACES a maybe for a human. This DECIDES, because an import
// running over thousands of rows has no human in the loop and the wrong decision
// is the expensive one: a source string landing on the wrong option is a product
// that reads as something it is not, and nothing errors.
//
// So it resolves only what it can resolve UNAMBIGUOUSLY, and returns null for
// everything else. Null is not a failure — it is the review queue, which is where
// an unrecognised spelling is supposed to go.
// ---------------------------------------------------------------------------

// Exact match, case- and whitespace-insensitive. The precise level.
const exactKey = (text: string): string => text.trim().toLowerCase();

/**
 * The written forms an option answers to, at both precisions.
 *
 * ONE definition, used by the resolver AND by the conflict check, so a refusal
 * covers exactly the ambiguity the resolver would have hit. Two definitions here
 * would let a save pass its own check and then resolve to nothing.
 */
const optionForms = (option: SpecOption): { exact: string[]; loose: string[] } => {
  const written = [option.value, option.label, ...(option.aliases ?? [])];
  return {
    exact: written.map(exactKey).filter((form) => form !== ""),
    // Punctuation and spacing dropped, which is the whole point at this level:
    // "866.0–866.5 MHz" and "866.0 – 866.5 MHz" differ by two spaces and a dash
    // and are the same band. Forms that squash to nothing (`||`) or to one or two
    // characters are excluded — at that length a loose match is a coincidence.
    loose: written
      .map(squash)
      .filter((form) => form.length >= 3),
  };
};

/**
 * The option a source string means, or null when that cannot be decided.
 *
 * FOUR PASSES, in falling order of certainty, and the order is the safety
 * property: identity beats display text, display text beats a nickname, and an
 * exact spelling beats a punctuation-blind one. A value that IS an option's
 * stored identity can never be stolen by something else's alias.
 *
 * A pass matching SEVERAL options returns null rather than the first. Two options
 * answering to one string is a library defect, and picking either one hides it
 * behind data that looks entered.
 *
 * Retired options are matched. A source still writing a retired spelling means
 * that product genuinely holds the retired value, and re-deriving a live one for
 * it would rewrite history to look tidier than it was.
 */
export const resolveOptionByText = (
  text: string,
  options: SpecOption[],
): SpecOption | null => {
  const wanted = exactKey(text);
  if (wanted === "") {
    return null;
  }
  const forms = options.map(
    (option) => [option, optionForms(option)] as const,
  );

  const decide = (matched: SpecOption[]): SpecOption | null =>
    matched.length === 1 ? (matched[0] ?? null) : null;

  const byValue = forms.filter(([option]) => exactKey(option.value) === wanted);
  if (byValue.length > 0) {
    return decide(byValue.map(([option]) => option));
  }
  const byLabel = forms.filter(([option]) => exactKey(option.label) === wanted);
  if (byLabel.length > 0) {
    return decide(byLabel.map(([option]) => option));
  }
  const byAlias = forms.filter(([option]) =>
    (option.aliases ?? []).some((alias) => exactKey(alias) === wanted),
  );
  if (byAlias.length > 0) {
    return decide(byAlias.map(([option]) => option));
  }
  const squashed = squash(text);
  if (squashed.length < 3) {
    return null;
  }
  const loose = forms.filter(([, form]) => form.loose.includes(squashed));
  return decide(loose.map(([option]) => option));
};

// One written form that more than one option answers to.
export type AliasConflict = {
  // The spelling itself, as the author typed it.
  alias: string;
  // The options fighting over it, by label.
  claimedBy: string[];
};

/**
 * Aliases that would make a resolution ambiguous.
 *
 * Scoped to ALIASES on purpose. Two options have always been allowed to share a
 * LABEL — `mergeOptions` keeps them apart by value and the admin shows both — so
 * starting to refuse that here would reject lists that have been saved for months.
 * An alias is new, so refusing an ambiguous one breaks nothing and stops the
 * ambiguity from ever entering.
 *
 * Both precisions are checked, because the resolver uses both: an alias that only
 * collides once punctuation is dropped ("866.0-866.5" against another option's
 * "866.0 – 866.5") is exactly as ambiguous as an identical one, and it is the
 * harder of the two to spot by eye.
 */
export const aliasConflicts = (options: SpecOption[]): AliasConflict[] => {
  const forms = options.map(
    (option) => [option, optionForms(option)] as const,
  );
  const conflicts: AliasConflict[] = [];
  const reported = new Set<string>();

  for (const [owner] of forms) {
    for (const alias of owner.aliases ?? []) {
      const exact = exactKey(alias);
      const loose = squash(alias);
      const rivals = forms
        .filter(([other]) => other.value !== owner.value)
        .filter(
          ([, form]) =>
            form.exact.includes(exact) ||
            (loose.length >= 3 && form.loose.includes(loose)),
        )
        .map(([other]) => other.label);
      if (rivals.length === 0) {
        continue;
      }
      // The same clash is visible from both sides; report it once.
      const signature = [owner.label, ...rivals].sort().join(" ");
      if (reported.has(signature)) {
        continue;
      }
      reported.add(signature);
      conflicts.push({ alias, claimedBy: [owner.label, ...rivals] });
    }
  }
  return conflicts;
};

// ---------------------------------------------------------------------------
// The same problem one level up — which ATTRIBUTE a source column means
//
// "Sensitive element", "Sensitive elements" and "Sensing element" are three
// columns in the source data and one attribute here. Resolving them is the same
// decision as resolving an option spelling, made against the same rules, so it is
// the same code with `key` standing where `value` stood.
// ---------------------------------------------------------------------------

// Just enough of an attribute to be named. Deliberately structural rather than
// the full row: the importer, the library service and the tests all have
// different shapes of attribute in hand and none of them should have to build a
// whole one to ask what a column means.
export type NameableAttribute = {
  uuid: string;
  key: string;
  label: string;
  labelAliases?: string[] | null;
};

const attributeForms = (
  attribute: NameableAttribute,
): { exact: string[]; loose: string[] } => {
  const written = [
    attribute.key,
    attribute.label,
    ...(attribute.labelAliases ?? []),
  ];
  return {
    exact: written.map(exactKey).filter((form) => form !== ""),
    loose: written.map(squash).filter((form) => form.length >= 3),
  };
};

/**
 * The attribute a source label means, or null when that cannot be decided.
 *
 * Same four passes and the same refusal to guess as `resolveOptionByText`, and
 * for a sharper reason: an option resolved wrongly gives a product the wrong
 * value, while a COLUMN resolved wrongly gives every product in the import the
 * wrong value, under an attribute whose own values then look plausible.
 */
export const resolveAttributeByText = (
  text: string,
  attributes: NameableAttribute[],
): NameableAttribute | null => {
  const wanted = exactKey(text);
  if (wanted === "") {
    return null;
  }
  const decide = (matched: NameableAttribute[]): NameableAttribute | null =>
    matched.length === 1 ? (matched[0] ?? null) : null;

  const byKey = attributes.filter((attr) => exactKey(attr.key) === wanted);
  if (byKey.length > 0) {
    return decide(byKey);
  }
  const byLabel = attributes.filter((attr) => exactKey(attr.label) === wanted);
  if (byLabel.length > 0) {
    return decide(byLabel);
  }
  const byAlias = attributes.filter((attr) =>
    (attr.labelAliases ?? []).some((alias) => exactKey(alias) === wanted),
  );
  if (byAlias.length > 0) {
    return decide(byAlias);
  }
  const squashed = squash(text);
  if (squashed.length < 3) {
    return null;
  }
  return decide(
    attributes.filter((attr) =>
      attributeForms(attr).loose.includes(squashed),
    ),
  );
};

/**
 * Label aliases on ONE attribute that another attribute already answers to.
 *
 * The library-wide twin of `aliasConflicts`, and it has to be checked against the
 * whole library rather than within one row — the collision that matters is
 * between two DIFFERENT attributes, which is invisible from either one alone.
 */
export const labelAliasConflicts = (
  candidate: NameableAttribute,
  others: NameableAttribute[],
): AliasConflict[] => {
  const rivals = others.filter((other) => other.uuid !== candidate.uuid);
  const conflicts: AliasConflict[] = [];
  for (const alias of candidate.labelAliases ?? []) {
    const exact = exactKey(alias);
    const loose = squash(alias);
    const claimed = rivals
      .filter((other) => {
        const form = attributeForms(other);
        return (
          form.exact.includes(exact) ||
          (loose.length >= 3 && form.loose.includes(loose))
        );
      })
      .map((other) => other.label);
    if (claimed.length > 0) {
      conflicts.push({ alias, claimedBy: [candidate.label, ...claimed] });
    }
  }
  return conflicts;
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
/**
 * A borrowed-list narrowing, as it will be stored.
 *
 * Empty becomes NULL rather than `[]`, because the two would otherwise be a
 * distinction without a difference that every reader has to remember: null means
 * "all the words", and an empty array means the same thing while looking like
 * "none of them".
 */
export const normalizeSetValues = (
  values: string[] | null | undefined,
): string[] | null => {
  const cleaned = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return cleaned.length > 0 ? [...new Set(cleaned)] : null;
};

export const resolveVocabulary = (
  own: {
    ordered: boolean;
    options: SpecOption[] | null;
    optionSetUuid?: string | null;
    setValues?: string[] | null;
  },
  sets: OptionSetIndex,
): OptionVocabulary => {
  if (!own.optionSetUuid) {
    return { ordered: own.ordered, options: own.options ?? [] };
  }
  const set = sets.get(own.optionSetUuid);
  if (!set) {
    return { ordered: own.ordered, options: [] };
  }
  // The borrowed list, narrowed to the words this attribute actually uses.
  //
  // THE ONE PLACE this happens, which is why a group's sub-fields get it for
  // free — `resolveGroupFields` resolves through here too. Every reader above is
  // handed the narrowed list and never learns it was narrowed, exactly as it
  // never learns the words were borrowed.
  //
  // `ordered` still comes from the SET. Whether 1G is smaller than 10G belongs
  // to the words, not to whoever borrowed a few of them.
  if (!own.setValues || own.setValues.length === 0) {
    return set;
  }
  const chosen = new Set(own.setValues);
  const narrowed = set.options.filter((option) => chosen.has(option.value));
  // A slice naming only words the set no longer has would otherwise leave the
  // attribute with an empty dropdown and no explanation. The whole set is the
  // safer answer: over-offering is visible, offering nothing looks broken.
  return narrowed.length > 0
    ? { ordered: set.ordered, options: narrowed }
    : set;
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
  // Which of that vocabulary's words this column uses. Empty = all of them.
  setValues?: string[] | null;
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
      // Stored only alongside a pointer, on the same reasoning as the attribute's
      // own narrowing: a slice of a list this column does not borrow is a setting
      // waiting to surprise whoever points it at one later.
      setValues: shared ? normalizeSetValues(entry.setValues) : null,
    });
  });

  return merged;
};
