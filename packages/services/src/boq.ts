import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import {
  BoqPartners,
  SelectBoqPartners,
} from "../../../db/schema/boq-partners";
import {
  BoqItems,
  Boqs,
  SelectBoqItems,
  SelectBoqs,
} from "../../../db/schema/boqs";

export type { SelectBoqItems, SelectBoqs };
import { CartItems, Carts } from "../../../db/schema/carts";
import { Categories } from "../../../db/schema/categories";
import { Products } from "../../../db/schema/products";
import { Users } from "../../../db/schema/users";
import { findNearestApprovedPartners, type MatchedPartner } from "./partners";

export type BoqDetail = {
  boq: SelectBoqs;
  items: SelectBoqItems[];
};

/** A BOQ enriched with its customer, line-item count and subtotal (admin list). */
export type BoqListItem = SelectBoqs & {
  customerName: string | null;
  itemCount: number;
  subtotal: number;
};

/**
 * Creates a draft BOQ from the user's cart: the cart lines are snapshotted
 * into BoqItems (so the quote is fixed) and the cart is then cleared.
 */
export const createBoqFromCart = async (
  userUuid: string,
): Promise<SelectBoqs> => {
  const [cart] = await db
    .select({ uuid: Carts.uuid })
    .from(Carts)
    .where(eq(Carts.userUuid, userUuid));
  if (!cart) throw new Error("Your cart is empty");

  const lines = await db
    .select({
      productUuid: CartItems.productUuid,
      name: Products.name,
      categoryName: Categories.name,
      unitPrice: Products.price,
      currency: Products.currency,
      quantity: CartItems.quantity,
    })
    .from(CartItems)
    .innerJoin(Products, eq(CartItems.productUuid, Products.uuid))
    .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
    .where(eq(CartItems.cartUuid, cart.uuid));
  if (lines.length === 0) throw new Error("Your cart is empty");

  const boqUuid = randomUUID();
  const reference = `BOQ-${boqUuid.slice(0, 8).toUpperCase()}`;

  await db.insert(Boqs).values({ uuid: boqUuid, userUuid, reference });
  await db.insert(BoqItems).values(
    lines.map((line) => ({
      uuid: randomUUID(),
      boqUuid,
      productUuid: line.productUuid,
      name: line.name,
      categoryName: line.categoryName,
      unitPrice: line.unitPrice,
      currency: line.currency,
      quantity: line.quantity,
    })),
  );

  await db.delete(CartItems).where(eq(CartItems.cartUuid, cart.uuid));

  const [boq] = await db.select().from(Boqs).where(eq(Boqs.uuid, boqUuid));
  if (!boq) throw new Error("Failed to create BOQ");
  return boq;
};

/** A BOQ with its line items (or null if it doesn't exist). */
export const getBoq = async (boqUuid: string): Promise<BoqDetail | null> => {
  const [boq] = await db.select().from(Boqs).where(eq(Boqs.uuid, boqUuid));
  if (!boq) return null;

  const items = await db
    .select()
    .from(BoqItems)
    .where(eq(BoqItems.boqUuid, boqUuid))
    .orderBy(asc(BoqItems.createdAt));

  return { boq, items };
};

/** All BOQs created by a user, newest first. */
export const getUserBoqs = async (userUuid: string): Promise<SelectBoqs[]> =>
  db
    .select()
    .from(Boqs)
    .where(eq(Boqs.userUuid, userUuid))
    .orderBy(desc(Boqs.createdAt));

/** Every BOQ with its customer, item count and subtotal (admin oversight). */
export const getAllBoqs = async (): Promise<BoqListItem[]> => {
  const boqs = await db
    .select({
      ...getTableColumns(Boqs),
      customerName: Users.fullName,
    })
    .from(Boqs)
    .leftJoin(Users, eq(Boqs.userUuid, Users.uuid))
    .orderBy(desc(Boqs.createdAt));

  const totals = await db
    .select({
      boqUuid: BoqItems.boqUuid,
      itemCount: sql<number>`sum(${BoqItems.quantity})`,
      subtotal: sql<number>`sum(${BoqItems.unitPrice} * ${BoqItems.quantity})`,
    })
    .from(BoqItems)
    .groupBy(BoqItems.boqUuid);

  const totalsByBoq = new Map(totals.map((row) => [row.boqUuid, row]));

  return boqs.map((boq) => {
    const total = totalsByBoq.get(boq.uuid);
    return {
      ...boq,
      itemCount: Number(total?.itemCount ?? 0),
      subtotal: Number(total?.subtotal ?? 0),
    };
  });
};

/** Assigns (or clears, when `preSeller` is null) the pre-seller for a BOQ. */
export const assignBoq = async (
  boqUuid: string,
  preSeller: { id: string; name: string } | null,
): Promise<void> => {
  await db
    .update(Boqs)
    .set({
      assignedPreSellerId: preSeller?.id ?? null,
      assignedPreSellerName: preSeller?.name ?? null,
    })
    .where(eq(Boqs.uuid, boqUuid));
};

/**
 * BOQs assigned to a given pre-seller (Clerk user id), newest first, each
 * enriched with the customer, line-item count and subtotal for the list view.
 */
export const getAssignedBoqs = async (
  preSellerId: string,
): Promise<BoqListItem[]> => {
  const boqs = await db
    .select({
      ...getTableColumns(Boqs),
      customerName: Users.fullName,
    })
    .from(Boqs)
    .leftJoin(Users, eq(Boqs.userUuid, Users.uuid))
    .where(eq(Boqs.assignedPreSellerId, preSellerId))
    .orderBy(desc(Boqs.createdAt));

  const totals = await db
    .select({
      boqUuid: BoqItems.boqUuid,
      itemCount: sql<number>`sum(${BoqItems.quantity})`,
      subtotal: sql<number>`sum(${BoqItems.unitPrice} * ${BoqItems.quantity})`,
    })
    .from(BoqItems)
    .groupBy(BoqItems.boqUuid);

  const totalsByBoq = new Map(totals.map((row) => [row.boqUuid, row]));

  return boqs.map((boq) => {
    const total = totalsByBoq.get(boq.uuid);
    return {
      ...boq,
      itemCount: Number(total?.itemCount ?? 0),
      subtotal: Number(total?.subtotal ?? 0),
    };
  });
};

// Loads a draft BOQ assigned to the pre-seller, throwing if it isn't theirs or
// has already been submitted.
const loadAssignedDraftBoq = async (
  preSellerId: string,
  boqUuid: string,
): Promise<SelectBoqs> => {
  const [boq] = await db
    .select()
    .from(Boqs)
    .where(
      and(eq(Boqs.uuid, boqUuid), eq(Boqs.assignedPreSellerId, preSellerId)),
    );
  if (!boq) throw new Error("BOQ not found");
  if (boq.status !== "draft") {
    throw new Error("This BOQ has already been submitted");
  }
  return boq;
};

/**
 * Previews the three approved partners a draft BOQ would be dispatched to,
 * closest to the customer first — used to populate the pre-seller's send dialog
 * before anything is committed.
 */
export const getNearestPartnersForBoq = async ({
  preSellerId,
  boqUuid,
}: {
  preSellerId: string;
  boqUuid: string;
}): Promise<MatchedPartner[]> => {
  const boq = await loadAssignedDraftBoq(preSellerId, boqUuid);

  const [customer] = await db
    .select({ location: Users.location })
    .from(Users)
    .where(eq(Users.uuid, boq.userUuid));

  return findNearestApprovedPartners(customer?.location ?? null, 3);
};

export type SubmitBoqResult = {
  boq: SelectBoqs;
  partners: MatchedPartner[];
};

/**
 * Submits a draft BOQ the pre-seller has reviewed: marks it submitted and
 * dispatches it to the three approved partners closest to the customer's
 * location, attaching the per-partner note the pre-seller wrote (keyed by the
 * partner's Clerk user id). Re-runnable dispatch is idempotent (prior matches
 * are replaced).
 */
export const submitReviewedBoq = async ({
  preSellerId,
  boqUuid,
  comments = {},
}: {
  preSellerId: string;
  boqUuid: string;
  comments?: Record<string, string>;
}): Promise<SubmitBoqResult> => {
  const boq = await loadAssignedDraftBoq(preSellerId, boqUuid);

  const items = await db
    .select({ id: BoqItems.id })
    .from(BoqItems)
    .where(eq(BoqItems.boqUuid, boqUuid));
  if (items.length === 0) {
    throw new Error("Add at least one item before submitting");
  }

  const [customer] = await db
    .select({ location: Users.location })
    .from(Users)
    .where(eq(Users.uuid, boq.userUuid));

  const partners = await findNearestApprovedPartners(
    customer?.location ?? null,
    3,
  );
  if (partners.length === 0) {
    throw new Error(
      "No approved partners are available to receive this BOQ yet",
    );
  }

  await db
    .update(Boqs)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(eq(Boqs.id, boq.id));

  await db.delete(BoqPartners).where(eq(BoqPartners.boqUuid, boqUuid));
  await db.insert(BoqPartners).values(
    partners.map((partner) => {
      const note = comments[partner.clerkUserId]?.trim();
      return {
        uuid: randomUUID(),
        boqUuid,
        partnerClerkUserId: partner.clerkUserId,
        partnerRequestUuid: partner.partnerRequestUuid,
        partnerName: partner.name,
        partnerLocation: partner.location,
        preSellerComment: note ? note : null,
        matchRank: partner.rank,
      };
    }),
  );

  const [updated] = await db.select().from(Boqs).where(eq(Boqs.id, boq.id));
  if (!updated) throw new Error("Failed to submit BOQ");
  return { boq: updated, partners };
};

/** The partners a BOQ was dispatched to (closest first). */
export const getBoqPartners = async (
  boqUuid: string,
): Promise<SelectBoqPartners[]> =>
  db
    .select()
    .from(BoqPartners)
    .where(eq(BoqPartners.boqUuid, boqUuid))
    .orderBy(asc(BoqPartners.matchRank));

/** A BOQ enriched with the match rank/dispatch time for a partner's list. */
export type PartnerBoqListItem = SelectBoqs & {
  matchRank: number;
  dispatchedAt: Date;
};

/** BOQs dispatched to a given partner (Clerk user id), newest first. */
export const getPartnerBoqs = async (
  partnerClerkUserId: string,
): Promise<PartnerBoqListItem[]> =>
  db
    .select({
      ...getTableColumns(Boqs),
      matchRank: BoqPartners.matchRank,
      dispatchedAt: BoqPartners.createdAt,
    })
    .from(BoqPartners)
    .innerJoin(Boqs, eq(BoqPartners.boqUuid, Boqs.uuid))
    .where(eq(BoqPartners.partnerClerkUserId, partnerClerkUserId))
    .orderBy(desc(BoqPartners.createdAt));

/** A dispatched BOQ with its items plus the note the pre-seller left for it. */
export type PartnerBoqDetail = BoqDetail & {
  preSellerComment: string | null;
};

/** A dispatched BOQ with its items, only if it was sent to this partner. */
export const getPartnerBoq = async (
  partnerClerkUserId: string,
  boqUuid: string,
): Promise<PartnerBoqDetail | null> => {
  const [link] = await db
    .select({ preSellerComment: BoqPartners.preSellerComment })
    .from(BoqPartners)
    .where(
      and(
        eq(BoqPartners.boqUuid, boqUuid),
        eq(BoqPartners.partnerClerkUserId, partnerClerkUserId),
      ),
    );
  if (!link) return null;

  const detail = await getBoq(boqUuid);
  if (!detail) return null;

  return { ...detail, preSellerComment: link.preSellerComment };
};
