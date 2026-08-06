import { asc, eq, inArray, sql } from "drizzle-orm";
import { generateUuid, slugify } from "utils";
import { db } from "../../../db";
import { Products } from "../../../db/schema/products";
import { SelectVariants, Variants } from "../../../db/schema/variants";
import { ValidationError } from "./errors";
// Identity lives in its own module because this one opens a database connection
// on import, and the logic that decides whether two rows are the same product
// has to be testable on its own.
import { variantSignature } from "./variant-identity";

// ---------------------------------------------------------------------------
// VARIANTS — the axes on which two otherwise identical products differ.
//
// "RB" / "SB", "(2G)" / "(4G)", "White" / "Yellow", "without casing", "UL". A
// product carries as many at once as it needs, because they stack: `FireProtect
// 2 RB (CO) UL Jeweller` differs from its siblings on four axes.
//
// This service exists to protect one thing: that the SAME axis is always spelled
// the same way. Typed fresh on each product, "4G", "(4G)", "4 G" and "LTE"
// become four axes no query can group and no importer can match — and the fork
// is invisible, because every product looks entered. It is the same failure the
// option library was built to prevent, one level up.
// ---------------------------------------------------------------------------

export type Variant = SelectVariants & {
  // How many products carry it. Drives the "in use by" line and the delete
  // guard's message — an author needs to know before they try, not after.
  productCount: number;
};

export type VariantInput = {
  name: string;
};

/**
 * Every variant, with what uses it. TWO queries, never one per variant.
 *
 * The usage count is a JSON containment scan rather than a join, because the set
 * lives on the product as an array. One aggregate over Products, not one query
 * per variant — the connection ceiling is shared across every app in the repo and
 * a fan-out here would spend it on a dropdown.
 */
export const getVariants = async (): Promise<Variant[]> => {
  const [rows, products] = await Promise.all([
    db.select().from(Variants).orderBy(asc(Variants.order), asc(Variants.name)),
    db.select({ variantUuids: Products.variantUuids }).from(Products),
  ]);

  const counts = new Map<string, number>();
  for (const product of products) {
    for (const uuid of product.variantUuids ?? []) {
      counts.set(uuid, (counts.get(uuid) ?? 0) + 1);
    }
  }

  return rows.map((row) => ({
    ...row,
    productCount: counts.get(row.uuid) ?? 0,
  }));
};

/**
 * Add a variant to the vocabulary.
 *
 * Refuses a name that already exists in comparable form. That is the entire
 * point of the table: an author adding "(4G)" beside "4G" has not added an axis,
 * they have forked one — and every product filed under the second spelling drops
 * out of every grouping that used the first, with nothing to look at.
 *
 * The comparison is punctuation- and case-blind, because that is exactly how the
 * fork happens. It is not fuzzy beyond that: "2G" and "4G" are one character
 * apart and genuinely different, and a matcher loose enough to catch a typo would
 * refuse the real pair.
 */
export const createVariant = async (input: VariantInput): Promise<Variant> => {
  const name = input.name.trim();
  if (name === "") {
    throw new ValidationError("A variant needs a name.");
  }
  const slug = slugify(name);
  if (slug === "") {
    throw new ValidationError(
      `"${name}" has no letters or digits in it, so there is nothing to tell it apart from another variant by.`,
    );
  }

  const [existing] = await db
    .select()
    .from(Variants)
    .where(eq(Variants.slug, slug))
    .limit(1);
  if (existing) {
    throw new ValidationError(
      existing.name === name
        ? `"${name}" is already a variant.`
        : `"${existing.name}" is already this variant written another way. Pick it instead — two spellings of one axis is how a variant family quietly splits in half.`,
    );
  }

  const [counted] = await db
    .select({ total: sql<number>`count(*)` })
    .from(Variants);

  const uuid = generateUuid();
  await db.insert(Variants).values({
    uuid,
    name,
    slug,
    order: Number(counted?.total ?? 0),
  });

  // Read back rather than assembling the row from what was sent. The defaults
  // and timestamps are the database's to decide, and a caller handed a
  // hand-built row would be holding one that does not match what was stored.
  const [created] = await db
    .select()
    .from(Variants)
    .where(eq(Variants.uuid, uuid))
    .limit(1);
  if (!created) {
    throw new ValidationError(`"${name}" could not be saved.`);
  }
  return { ...created, productCount: 0 };
};

/**
 * Remove a variant nothing uses.
 *
 * A variant products carry is REFUSED rather than cascaded. Deleting it would
 * silently change those products' identity signature — two rows that were
 * distinct would become the same product, and the constraint that was supposed to
 * notice is the one the delete just walked around.
 */
export const deleteVariant = async (uuid: string): Promise<void> => {
  const variants = await getVariants();
  const target = variants.find((variant) => variant.uuid === uuid);
  if (!target) {
    return;
  }
  if (target.productCount > 0) {
    throw new ValidationError(
      `"${target.name}" is carried by ${target.productCount} product(s). Removing it would change what makes each of them a distinct product, so take it off those first.`,
    );
  }
  await db.delete(Variants).where(eq(Variants.uuid, uuid));
};

/**
 * Resolve a product's variant uuids into the signature its identity uses.
 *
 * A uuid naming a variant that no longer exists is DROPPED rather than throwing.
 * The delete guard already refuses to remove a variant anything carries, so
 * reaching this means a hand-edited database — and a product that still saves,
 * under a signature built from the variants that do exist, is recoverable in a
 * way one that refuses to save is not.
 */
export const signatureForVariants = async (
  variantUuids: string[] | null | undefined,
): Promise<string | null> => {
  const uuids = [...new Set((variantUuids ?? []).filter(Boolean))];
  if (uuids.length === 0) {
    return null;
  }
  const rows = await db
    .select({ slug: Variants.slug })
    .from(Variants)
    .where(inArray(Variants.uuid, uuids));
  return variantSignature(rows.map((row) => row.slug));
};

/** The variants a product carries, in display order, for its detail view. */
export const getVariantsByUuids = async (
  variantUuids: string[] | null | undefined,
): Promise<SelectVariants[]> => {
  const uuids = [...new Set((variantUuids ?? []).filter(Boolean))];
  if (uuids.length === 0) {
    return [];
  }
  return db
    .select()
    .from(Variants)
    .where(inArray(Variants.uuid, uuids))
    .orderBy(asc(Variants.order), asc(Variants.name));
};
