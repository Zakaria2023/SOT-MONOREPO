import type { SpecificationType } from "../../../db/enum";
import type { ProductValues } from "../../../db/types";

// ---------------------------------------------------------------------------
// Storefront facet logic — PURE. No database, no framework.
//
// Split from `catalog-facets.ts` deliberately: that module opens a database
// connection to resolve a category, and this one is arithmetic over what it
// returned. Keeping them in one file made the pure half untestable without
// credentials, which is exactly the sort of coupling that stops the logic being
// covered.
// ---------------------------------------------------------------------------

export type FacetOption = {
  value: string;
  label: string;
  rank: number | null;
};

export type CategoryFacet = {
  // The attribute uuid. Also the URL key, so a shared facet link survives a
  // rename of the attribute it filters on.
  key: string;
  label: string;
  type: SpecificationType;
  unit: string | null;
  // Whether the option list is a scale, which changes what picking one MEANS:
  // on a scale the shopper is stating what they HAVE, and anything that fits it
  // qualifies. On an unordered list they are naming exactly what they want.
  ordered: boolean;
  options: FacetOption[];
};

/**
 * Turn a shopper's facet choices into the value sets the product query filters
 * on.
 *
 * On an ORDERED facet the pick is a floor, not an exact match: a shopper who
 * says "I have 1G" should still be shown the 10G switch, because it fits what
 * they have. So the choice expands upward to every option at or above the lowest
 * one picked.
 *
 * On an unordered facet the choice is literal — ticking 6GHz means 6GHz.
 */
export const expandFacetChoices = (
  facets: CategoryFacet[],
  chosen: Record<string, string[]>,
): Record<string, string[]> => {
  const expanded: Record<string, string[]> = {};

  for (const [key, values] of Object.entries(chosen)) {
    const facet = facets.find((entry) => entry.key === key);
    // A stale key from a previous category must not silently filter every
    // product away, so anything this category does not offer is dropped.
    if (!facet || values.length === 0) {
      continue;
    }
    if (!facet.ordered) {
      expanded[key] = values;
      continue;
    }
    const ranks = values
      .map((value) => facet.options.find((option) => option.value === value))
      .map((option) => option?.rank)
      .filter((rank): rank is number => rank !== null && rank !== undefined);
    if (ranks.length === 0) {
      expanded[key] = values;
      continue;
    }
    const floor = Math.min(...ranks);
    expanded[key] = facet.options
      .filter((option) => option.rank !== null && option.rank >= floor)
      .map((option) => option.value);
  }
  return expanded;
};

/**
 * The shopper's facet choices as a value map the reveal can be evaluated
 * against — so a conditional facet appears once its trigger is ticked.
 *
 * A single tick becomes a scalar and several become an array, matching exactly
 * how a product stores the same attribute. That is what lets ONE evaluator read
 * both a product's values and a shopper's filter state.
 */
export const facetSelectionValues = (
  chosen: Record<string, string[]>,
  facets: CategoryFacet[],
): ProductValues => {
  const values: ProductValues = {};

  for (const [key, picked] of Object.entries(chosen)) {
    const first = picked[0];
    if (first === undefined) {
      continue;
    }
    const facet = facets.find((entry) => entry.key === key);
    if (facet?.type === "boolean") {
      values[key] = first === "true";
      continue;
    }
    if (facet?.type === "number") {
      const parsed = Number(first);
      if (Number.isFinite(parsed)) {
        values[key] = parsed;
      }
      continue;
    }
    values[key] = picked.length === 1 ? first : picked;
  }
  return values;
};

/** An option's position on its facet's scale, or null when it has none. */
export const facetOptionRank = (
  facet: CategoryFacet,
  value: string,
): number | null =>
  facet.options.find((option) => option.value === value)?.rank ?? null;
