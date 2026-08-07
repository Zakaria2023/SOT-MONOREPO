import { resolveUniqueSlug, slugify } from "utils";

/** A product's slug, as the uniqueness decision needs to see it. */
export type SlugFamilyRow = {
  uuid: string;
  slug: string;
};

/**
 * Whether `slug` is one THIS base could have produced.
 *
 * The query that gathers the family uses `LIKE base-%`, which is wider than the
 * numbered family: for base `bulletcam-hl` it also catches `bulletcam-hl-extra`,
 * a different product whose name merely starts the same way. Only an exact base
 * or a base with a purely numeric suffix belongs.
 *
 * Getting this wrong is silent: a product renamed from "Bulletcam HL Extra" to
 * "Bulletcam HL" would keep answering to `bulletcam-hl-extra`, and the only
 * symptom is a URL nobody notices is stale.
 */
export const isInSlugFamily = (slug: string, base: string): boolean =>
  slug === base ||
  (slug.startsWith(`${base}-`) && /^\d+$/.test(slug.slice(base.length + 1)));

/**
 * The slug a product should hold, given the slugs already around it.
 *
 * Pure, and separate from the query that feeds it, so the two rules that matter
 * can be tested: a NEW product never steals a slug, and an EXISTING one never
 * loses the slug it already answers to.
 *
 * Why a product keeps its slug: `-2` is assigned by arrival order, so if every
 * save re-derived from scratch, renaming one product would shuffle the suffix
 * onto its sibling and break a URL belonging to a row nobody touched.
 */
export const chooseProductSlug = (
  name: string,
  family: SlugFamilyRow[],
  selfUuid?: string,
): string | null => {
  const base = slugify(name);
  if (!base) {
    return null;
  }

  const mine = family.find((row) => row.uuid === selfUuid);
  if (mine && isInSlugFamily(mine.slug, base)) {
    return mine.slug;
  }

  return resolveUniqueSlug(base, new Set(family.map((row) => row.slug)));
};
