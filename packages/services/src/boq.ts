import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
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

/** Submits a draft BOQ for review (verifies ownership and draft status). */
export const submitBoq = async (
  userUuid: string,
  boqUuid: string,
): Promise<void> => {
  const [boq] = await db
    .select()
    .from(Boqs)
    .where(and(eq(Boqs.uuid, boqUuid), eq(Boqs.userUuid, userUuid)));
  if (!boq) throw new Error("BOQ not found");
  if (boq.status !== "draft") {
    throw new Error("This BOQ has already been submitted");
  }

  await db
    .update(Boqs)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(eq(Boqs.id, boq.id));
};

/** All submitted BOQs (for the pre-seller review queue), newest first. */
export const getSubmittedBoqs = async (): Promise<SelectBoqs[]> =>
  db
    .select()
    .from(Boqs)
    .where(eq(Boqs.status, "submitted"))
    .orderBy(desc(Boqs.submittedAt));

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

/** BOQs assigned to a given pre-seller (Clerk user id), newest first. */
export const getAssignedBoqs = async (
  preSellerId: string,
): Promise<SelectBoqs[]> =>
  db
    .select()
    .from(Boqs)
    .where(eq(Boqs.assignedPreSellerId, preSellerId))
    .orderBy(desc(Boqs.submittedAt));
