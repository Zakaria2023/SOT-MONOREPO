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
import { CartItems, Carts } from "../../../db/schema/carts";
import { Categories } from "../../../db/schema/categories";
import { Products } from "../../../db/schema/products";
import { SelectUsers, Users } from "../../../db/schema/users";
import {
  getApprovedPartnerOptions,
  type BoqPartnerOptions,
  type MatchedPartner,
} from "./partners";

export type { SelectBoqItems, SelectBoqs };

export type BoqDetail = {
  boq: SelectBoqs;
  items: SelectBoqItems[];
};

export type BoqListItem = SelectBoqs & {
  customerName: SelectUsers["fullName"] | null;
  itemCount: number;
  subtotal: number;
};

export type PartnerBoqListItem = SelectBoqs & {
  matchRank: NonNullable<SelectBoqPartners["matchRank"]>;
  dispatchedAt: SelectBoqPartners["createdAt"];
};

export type SubmitBoqResult = {
  boq: SelectBoqs;
  partners: MatchedPartner[];
};

export type PartnerBoqDetail = BoqDetail & {
  preSellerComment: SelectBoqPartners["preSellerComment"];
};

export const createBoqFromCart = async (
  userUuid: string,
): Promise<SelectBoqs> => {
  const [cart] = await db
    .select({ uuid: Carts.uuid })
    .from(Carts)
    .where(eq(Carts.userUuid, userUuid));
  if (!cart) {
    throw new Error("Your cart is empty");
  }

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
  if (lines.length === 0) {
    throw new Error("Your cart is empty");
  }

  const boqUuid = randomUUID();
  const reference = `BOQ-${boqUuid.slice(0, 8).toUpperCase()}`;

  return db.transaction(async (tx) => {
    await tx.insert(Boqs).values({ uuid: boqUuid, userUuid, reference });
    await tx.insert(BoqItems).values(
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

    await tx.delete(CartItems).where(eq(CartItems.cartUuid, cart.uuid));

    const [boq] = await tx.select().from(Boqs).where(eq(Boqs.uuid, boqUuid));
    if (!boq) {
      throw new Error("Failed to create BOQ");
    }
    return boq;
  });
};

export const getBoq = async (boqUuid: string): Promise<BoqDetail | null> => {
  const rows = await db
    .select({ boq: getTableColumns(Boqs), item: getTableColumns(BoqItems) })
    .from(Boqs)
    .leftJoin(BoqItems, eq(BoqItems.boqUuid, Boqs.uuid))
    .where(eq(Boqs.uuid, boqUuid))
    .orderBy(asc(BoqItems.createdAt));

  const [first] = rows;
  if (!first) return null;

  const items = rows.flatMap((row) => (row.item ? [row.item] : []));

  return { boq: first.boq, items };
};

export const getUserBoqs = async (userUuid: string): Promise<SelectBoqs[]> =>
  db
    .select()
    .from(Boqs)
    .where(eq(Boqs.userUuid, userUuid))
    .orderBy(desc(Boqs.createdAt));

const attachBoqTotals = async <T extends { uuid: string }>(
  boqs: T[],
): Promise<(T & { itemCount: number; subtotal: number })[]> => {
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
      itemCount: total?.itemCount ?? 0,
      subtotal: total?.subtotal ?? 0,
    };
  });
};

export const getAllBoqs = async (): Promise<BoqListItem[]> => {
  const boqs = await db
    .select({
      ...getTableColumns(Boqs),
      customerName: Users.fullName,
    })
    .from(Boqs)
    .leftJoin(Users, eq(Boqs.userUuid, Users.uuid))
    .orderBy(desc(Boqs.createdAt));

  return attachBoqTotals(boqs);
};

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

  return attachBoqTotals(boqs);
};

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
  if (!boq) {
    throw new Error("BOQ not found");
  }
  if (boq.status !== "draft") {
    throw new Error("This BOQ has already been submitted");
  }
  return boq;
};

export const getBoqPartnerOptions = async ({
  preSellerId,
  boqUuid,
}: {
  preSellerId: string;
  boqUuid: string;
}): Promise<BoqPartnerOptions> => {
  const boq = await loadAssignedDraftBoq(preSellerId, boqUuid);

  const [customer] = await db
    .select({ location: Users.location })
    .from(Users)
    .where(eq(Users.uuid, boq.userUuid));

  return getApprovedPartnerOptions(customer?.location ?? null);
};

export const submitReviewedBoq = async ({
  preSellerId,
  boqUuid,
  partnerClerkUserIds,
  comments = {},
}: {
  preSellerId: string;
  boqUuid: string;
  partnerClerkUserIds: string[];
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

  // Only genuinely approved partners may be dispatched — resolve the client's
  // selection against the server's current options rather than trusting it.
  const options = await getApprovedPartnerOptions(customer?.location ?? null);
  const selectedIds = new Set(partnerClerkUserIds);
  const otherById = new Map(
    options.others.map((partner) => [partner.clerkUserId, partner]),
  );

  // Close matches keep their closeness order; hand-picked others follow in the
  // order the pre-seller chose them.
  const selectedClose = options.close.filter((partner) =>
    selectedIds.has(partner.clerkUserId),
  );
  const selectedOthers = partnerClerkUserIds.flatMap((id) => {
    const partner = otherById.get(id);
    return partner ? [partner] : [];
  });
  const partners = [...selectedClose, ...selectedOthers];
  if (partners.length === 0) {
    throw new Error("Select at least one partner to send this BOQ to");
  }

  const updated = await db.transaction(async (tx) => {
    await tx
      .update(Boqs)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(eq(Boqs.id, boq.id));

    await tx.delete(BoqPartners).where(eq(BoqPartners.boqUuid, boqUuid));
    await tx.insert(BoqPartners).values(
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

    const [row] = await tx.select().from(Boqs).where(eq(Boqs.id, boq.id));
    if (!row) {
      throw new Error("Failed to submit BOQ");
    }
    return row;
  });

  return { boq: updated, partners };
};

export const getBoqPartners = async (
  boqUuid: string,
): Promise<SelectBoqPartners[]> =>
  db
    .select()
    .from(BoqPartners)
    .where(eq(BoqPartners.boqUuid, boqUuid))
    .orderBy(asc(BoqPartners.matchRank));

export const getPartnerBoqs = async (
  partnerClerkUserId: string,
): Promise<PartnerBoqListItem[]> =>
  db
    .select({
      ...getTableColumns(Boqs),
      matchRank: sql<number>`coalesce(${BoqPartners.matchRank}, 0)`,
      dispatchedAt: BoqPartners.createdAt,
    })
    .from(BoqPartners)
    .innerJoin(Boqs, eq(BoqPartners.boqUuid, Boqs.uuid))
    .where(eq(BoqPartners.partnerClerkUserId, partnerClerkUserId))
    .orderBy(desc(BoqPartners.createdAt));

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
