import type { SpecOption } from "../../../db/types";

// ---------------------------------------------------------------------------
// WHAT THE PRODUCTS ACTUALLY SAY, AGAINST WHAT THE LIBRARY ALLOWS.
//
// The library defines a vocabulary. The products are supposed to speak it. Over
// an import of a few hundred rows, three things drift apart, and each one fails
// in a different direction:
//
//   off_vocabulary  a product holds a value the attribute does not offer. Every
//                   set comparator silently misses it — `in ["af","at","bt"]`
//                   does not match "802.3af", so a rule that reads fine passes
//                   a product it was written to catch. This is the dangerous one.
//   unused_option   an option nothing has ever used. Usually harmless, and
//                   occasionally the sign of a typo two rows above it in the
//                   list that everyone has been picking instead.
//   near_duplicate  two options in use that differ only by case, spacing or
//                   punctuation — "Cat6a" and "CAT6A". Both real, both picked by
//                   somebody, and no comparator will ever match them together.
//
// All pure. The counting is done here rather than in SQL so the interesting
// cases can be tested without arranging them in a live catalogue first.
// ---------------------------------------------------------------------------

export type ValueUse = {
  value: string;
  products: number;
};

export type NearDuplicate = {
  // The normalised form the two share.
  normalised: string;
  values: ValueUse[];
};

export type AttributeSweep = {
  specUuid: string;
  label: string;
  // Values products hold that the attribute does not offer.
  offVocabulary: ValueUse[];
  // Options the attribute offers that nothing holds.
  unusedOptions: SpecOption[];
  nearDuplicates: NearDuplicate[];
  productsAnswering: number;
};

export type SweepInput = {
  attributes: {
    specUuid: string;
    label: string;
    options: SpecOption[];
  }[];
  // One entry per product per attribute it answers. A multi-select contributes
  // one entry per ticked value, which is what makes "how many products say
  // 802.3af" answerable rather than "how many products have a PoE answer".
  values: { specUuid: string; value: string }[];
};

/**
 * The form two spellings share when they are the same word.
 *
 * Case, spaces, hyphens, underscores and dots only. Deliberately no edit
 * distance and no stemming: this decides whether to put two values in front of a
 * human as suspicious, and a looser rule turns a useful short list into a wall
 * of false pairs nobody reads. The same containment-not-similarity reasoning the
 * import's controlled add already follows.
 */
export const normaliseForComparison = (value: string): string =>
  value.toLowerCase().replace(/[\s\-_.]/g, "");

const countByValue = (values: string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
};

export const sweepValues = (input: SweepInput): AttributeSweep[] => {
  const byAttribute = new Map<string, string[]>();
  for (const entry of input.values) {
    const existing = byAttribute.get(entry.specUuid);
    if (existing) {
      existing.push(entry.value);
      continue;
    }
    byAttribute.set(entry.specUuid, [entry.value]);
  }

  return input.attributes.map((attribute) => {
    const used = countByValue(byAttribute.get(attribute.specUuid) ?? []);
    const offered = new Set(attribute.options.map((option) => option.value));

    // An attribute with no option list is free text or a number. Every value it
    // holds is legitimate, so there is no vocabulary to be off.
    const hasVocabulary = attribute.options.length > 0;

    const offVocabulary: ValueUse[] = hasVocabulary
      ? [...used.entries()]
          .filter(([value]) => !offered.has(value))
          .map(([value, products]) => ({ value, products }))
          .sort((a, b) => b.products - a.products)
      : [];

    const unusedOptions = hasVocabulary
      ? attribute.options.filter((option) => !used.has(option.value))
      : [];

    // Grouped across everything in use, offered or not: the pair that matters
    // most is usually one legitimate option beside one typo of it.
    const byNormalised = new Map<string, ValueUse[]>();
    for (const [value, products] of used) {
      const key = normaliseForComparison(value);
      const existing = byNormalised.get(key);
      if (existing) {
        existing.push({ value, products });
        continue;
      }
      byNormalised.set(key, [{ value, products }]);
    }

    const nearDuplicates = [...byNormalised.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([normalised, values]) => ({ normalised, values }));

    return {
      specUuid: attribute.specUuid,
      label: attribute.label,
      offVocabulary,
      unusedOptions,
      nearDuplicates,
      productsAnswering: used.size === 0 ? 0 : [...used.values()].reduce((a, b) => a + b, 0),
    };
  });
};

/**
 * Only the attributes with something to answer for.
 *
 * An unused option counts only where the attribute has been answered at all.
 * Every option of an attribute nothing has ever filled in is trivially unused,
 * and reporting that is a statement about an empty catalogue rather than about
 * the option list — which, run against eight products, buries the two findings
 * that mean something under forty that do not.
 *
 * Off-vocabulary values and rival spellings need no such guard. They exist only
 * where somebody has answered.
 */
export const sweepProblems = (sweeps: AttributeSweep[]): AttributeSweep[] =>
  sweeps.filter(
    (sweep) =>
      sweep.offVocabulary.length > 0 ||
      sweep.nearDuplicates.length > 0 ||
      (sweep.unusedOptions.length > 0 && sweep.productsAnswering > 0),
  );
