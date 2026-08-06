import { and, asc, eq, inArray, or } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type { CompatibilityVerdict } from "../../../db/enum";
import { ProductCompatibility } from "../../../db/schema/product-compatibility";
import { ProductComposition } from "../../../db/schema/product-composition";
import { Products } from "../../../db/schema/products";
import { invalidateCatalogModel } from "./catalog-model";
import { ValidationError } from "./errors";

// ---------------------------------------------------------------------------
// AUTHORING THE TWO PRODUCT-TO-PRODUCT FACTS.
//
// Both tables were readable by the engine and writable by nobody. That is a
// worse state than not having them: the check runs, finds nothing, and reports a
// clean design — which is indistinguishable from a design that is actually
// clean.
//
// The reads and writes live together here, apart from the pure reducers in
// `product-compatibility` and `product-composition`, on the same split every
// other pair in this package uses: the module that decides what a stored value
// MEANS opens no connection, so it can be tested without one.
//
// Every write invalidates the catalog model. Both tables are loaded into it and
// cached in process, so without this an author records that two products clash
// and the very next cart is still judged by the list from before.
// ---------------------------------------------------------------------------

// One end of a link, resolved for display.
type LinkedProduct = {
  uuid: string;
  name: string;
  sku: string | null;
};

export type CompatibilityLink = {
  uuid: string;
  // The product this row was authored FROM, so the UI can tell which way round
  // it was written even when showing it on the other product's page.
  productUuidA: string;
  other: LinkedProduct;
  // True when the row was authored from the OTHER product. A pair is one fact
  // seen from both ends, and hiding that would let somebody author the mirror
  // image of a row that already exists.
  reversed: boolean;
  verdict: CompatibilityVerdict;
  note: string | null;
  source: string;
};

export type CompositionLink = {
  uuid: string;
  child: LinkedProduct;
  quantity: number;
  included: boolean;
  note: string | null;
};

const asLinked = (row: {
  uuid: string | null;
  name: string | null;
  sku: string | null;
}): LinkedProduct => ({
  uuid: row.uuid ?? "",
  name: row.name ?? "Unknown product",
  sku: row.sku,
});

/**
 * Every compatibility row touching this product, from EITHER side.
 *
 * Both directions, because a pair is one fact and an author looking at the
 * antenna needs to see the hub it was written against just as much as an author
 * looking at the hub. Showing only rows authored from here would let somebody
 * add the mirror image of a row that already exists — which the unique index
 * would then refuse with a message about a constraint.
 */
export const getCompatibilityLinks = async (
  productUuid: string,
): Promise<CompatibilityLink[]> => {
  const rows = await db
    .select({
      uuid: ProductCompatibility.uuid,
      productUuidA: ProductCompatibility.productUuidA,
      productUuidB: ProductCompatibility.productUuidB,
      verdict: ProductCompatibility.verdict,
      note: ProductCompatibility.note,
      source: ProductCompatibility.source,
      aName: Products.name,
      aSku: Products.sku,
    })
    .from(ProductCompatibility)
    .leftJoin(Products, eq(ProductCompatibility.productUuidB, Products.uuid))
    .where(
      or(
        eq(ProductCompatibility.productUuidA, productUuid),
        eq(ProductCompatibility.productUuidB, productUuid),
      ),
    )
    .orderBy(asc(ProductCompatibility.createdAt));

  // The join above resolved side B. A row authored from the other product needs
  // side A instead, and rather than a second join per row — the fan-out this
  // codebase does not do — the handful of names are fetched in one go.
  const reversedIds = [
    ...new Set(
      rows
        .filter((row) => row.productUuidA !== productUuid)
        .map((row) => row.productUuidA),
    ),
  ];
  const names = new Map<string, { name: string; sku: string | null }>();
  if (reversedIds.length > 0) {
    const owners = await db
      .select({ uuid: Products.uuid, name: Products.name, sku: Products.sku })
      .from(Products)
      .where(inArray(Products.uuid, reversedIds));
    for (const owner of owners) {
      names.set(owner.uuid, { name: owner.name, sku: owner.sku });
    }
  }

  return rows.map((row) => {
    const reversed = row.productUuidA !== productUuid;
    const owner = names.get(row.productUuidA);
    return {
      uuid: row.uuid,
      productUuidA: row.productUuidA,
      reversed,
      other: reversed
        ? asLinked({
            uuid: row.productUuidA,
            name: owner?.name ?? null,
            sku: owner?.sku ?? null,
          })
        : asLinked({
            uuid: row.productUuidB,
            name: row.aName,
            sku: row.aSku,
          }),
      verdict: row.verdict,
      note: row.note,
      source: row.source,
    };
  });
};

export type CompatibilityInput = {
  productUuidA: string;
  productUuidB: string;
  verdict: CompatibilityVerdict;
  note: string | null;
  source: string;
};

/**
 * Record that two products do, or do not, work together.
 *
 * Refuses a pair that already exists IN EITHER DIRECTION. The unique index only
 * covers the ordered pair, so (antenna, hub) and (hub, antenna) would both be
 * accepted by the database and then say two possibly-contradictory things about
 * one question — and which one a reader saw would depend on load order.
 */
export const addCompatibilityLink = async (
  input: CompatibilityInput,
): Promise<void> => {
  if (input.productUuidA === input.productUuidB) {
    throw new ValidationError(
      "A product cannot be compatible or incompatible with itself.",
    );
  }
  if (input.source.trim() === "") {
    throw new ValidationError(
      "Say where this came from — a datasheet, a compatibility PDF, or who decided it. A pair nobody can trace is one nobody can re-check when the brand publishes a new list.",
    );
  }

  const [existing] = await db
    .select({ uuid: ProductCompatibility.uuid })
    .from(ProductCompatibility)
    .where(
      or(
        and(
          eq(ProductCompatibility.productUuidA, input.productUuidA),
          eq(ProductCompatibility.productUuidB, input.productUuidB),
        ),
        and(
          eq(ProductCompatibility.productUuidA, input.productUuidB),
          eq(ProductCompatibility.productUuidB, input.productUuidA),
        ),
      ),
    )
    .limit(1);
  if (existing) {
    throw new ValidationError(
      "These two already have a recorded verdict. Remove it first if it needs changing — two rows about one pair is a question with no answer.",
    );
  }

  await db.insert(ProductCompatibility).values({
    uuid: generateUuid(),
    productUuidA: input.productUuidA,
    productUuidB: input.productUuidB,
    verdict: input.verdict,
    note: input.note?.trim() || null,
    source: input.source.trim(),
  });
  invalidateCatalogModel();
};

export const removeCompatibilityLink = async (uuid: string): Promise<void> => {
  await db
    .delete(ProductCompatibility)
    .where(eq(ProductCompatibility.uuid, uuid));
  invalidateCatalogModel();
};

/** What this product contains, or needs. Authored from the parent only. */
export const getCompositionLinks = async (
  productUuid: string,
): Promise<CompositionLink[]> => {
  const rows = await db
    .select({
      uuid: ProductComposition.uuid,
      childUuid: ProductComposition.childUuid,
      quantity: ProductComposition.quantity,
      included: ProductComposition.included,
      note: ProductComposition.note,
      childName: Products.name,
      childSku: Products.sku,
    })
    .from(ProductComposition)
    .innerJoin(Products, eq(ProductComposition.childUuid, Products.uuid))
    .where(eq(ProductComposition.parentUuid, productUuid))
    .orderBy(asc(ProductComposition.createdAt));

  return rows.map((row) => ({
    uuid: row.uuid,
    child: asLinked({
      uuid: row.childUuid,
      name: row.childName,
      sku: row.childSku,
    }),
    quantity: row.quantity,
    included: row.included,
    note: row.note,
  }));
};

export type CompositionInput = {
  parentUuid: string;
  childUuid: string;
  quantity: number;
  included: boolean;
  note: string | null;
};

/**
 * Record that a product contains, or requires, another.
 *
 * A cycle is refused at one level — a product cannot contain itself. Deeper
 * cycles (A contains B, B contains A) are NOT walked, deliberately: nothing in
 * the reader recurses, so a deep cycle is inert rather than dangerous, and a
 * guard that walked the graph on every save would be doing real work to prevent
 * a case that cannot hurt anything.
 */
export const addCompositionLink = async (
  input: CompositionInput,
): Promise<void> => {
  if (input.parentUuid === input.childUuid) {
    throw new ValidationError("A product cannot contain itself.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new ValidationError(
      "How many? It has to be a whole number, at least 1.",
    );
  }

  const [existing] = await db
    .select({ uuid: ProductComposition.uuid })
    .from(ProductComposition)
    .where(
      and(
        eq(ProductComposition.parentUuid, input.parentUuid),
        eq(ProductComposition.childUuid, input.childUuid),
      ),
    )
    .limit(1);
  if (existing) {
    throw new ValidationError(
      "This part is already listed. Remove it first to change the quantity — two rows for one part would be added together.",
    );
  }

  await db.insert(ProductComposition).values({
    uuid: generateUuid(),
    parentUuid: input.parentUuid,
    childUuid: input.childUuid,
    quantity: input.quantity,
    included: input.included,
    note: input.note?.trim() || null,
  });
  invalidateCatalogModel();
};

export const removeCompositionLink = async (uuid: string): Promise<void> => {
  await db.delete(ProductComposition).where(eq(ProductComposition.uuid, uuid));
  invalidateCatalogModel();
};

/**
 * Products an author can link to, for the pickers.
 *
 * The whole catalogue minus the product being edited. Small enough to send in
 * one go today, and the picker searches client-side; when it stops being small
 * this becomes a search endpoint rather than a bigger payload.
 */
export const getLinkableProducts = async (
  excludeUuid: string,
): Promise<LinkedProduct[]> => {
  const rows = await db
    .select({ uuid: Products.uuid, name: Products.name, sku: Products.sku })
    .from(Products)
    .orderBy(asc(Products.name));
  return rows.filter((row) => row.uuid !== excludeUuid);
};
