import { and, asc, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
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
import { ConflictError, ValidationError } from "./errors";
import {
  getApprovedPartnerOptions,
  type BoqPartnerOptions,
  type DbExecutor,
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

// Create a draft BOQ from one solution in the user's cart — the solution lines
// belonging to the given category — snapshotting each line, then removing just
// those lines from the cart. All in one transaction; other solutions and the
// user's standalone products stay in the cart.
export const createBoqFromCart = async (
  userUuid: string,
  categoryUuid: string,
): Promise<SelectBoqs> => {
  const [cart] = await db
    .select({ uuid: Carts.uuid })
    .from(Carts)
    .where(eq(Carts.userUuid, userUuid));
  if (!cart) {
    throw new ValidationError("Your cart is empty");
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
    .where(
      and(
        eq(CartItems.cartUuid, cart.uuid),
        eq(CartItems.kind, "solution"),
        eq(Products.categoryUuid, categoryUuid),
      ),
    );
  if (lines.length === 0) {
    throw new ValidationError("Add a solution to your cart before sending a BOQ");
  }

  const productUuids = lines.map((line) => line.productUuid);
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

    await tx
      .delete(CartItems)
      .where(
        and(
          eq(CartItems.cartUuid, cart.uuid),
          eq(CartItems.kind, "solution"),
          inArray(CartItems.productUuid, productUuids),
        ),
      );

    const [boq] = await tx.select().from(Boqs).where(eq(Boqs.uuid, boqUuid));
    if (!boq) {
      throw new Error("Failed to create BOQ");
    }
    return boq;
  });
};

// Load a single BOQ with its line items. Internal — callers use the ownership-
// scoped getUserBoq / getAssignedBoq / getPartnerBoq so access can't be skipped.
const getBoq = async (boqUuid: string): Promise<BoqDetail | null> => {
  const rows = await db
    .select({ boq: getTableColumns(Boqs), item: getTableColumns(BoqItems) })
    .from(Boqs)
    .leftJoin(BoqItems, eq(BoqItems.boqUuid, Boqs.uuid))
    .where(eq(Boqs.uuid, boqUuid))
    .orderBy(asc(BoqItems.createdAt));

  const [first] = rows;
  if (!first) {
    return null;
  }

  const items = rows.flatMap((row) => (row.item ? [row.item] : []));

  return { boq: first.boq, items };
};

/** A BOQ with its items, but only if it belongs to this customer. */
export const getUserBoq = async (
  userUuid: string,
  boqUuid: string,
): Promise<BoqDetail | null> => {
  const detail = await getBoq(boqUuid);
  if (!detail || detail.boq.userUuid !== userUuid) {
    return null;
  }
  return detail;
};

/** A BOQ with its items, but only if it is assigned to this pre-seller. */
export const getAssignedBoq = async (
  preSellerId: string,
  boqUuid: string,
): Promise<BoqDetail | null> => {
  const detail = await getBoq(boqUuid);
  if (!detail || detail.boq.assignedPreSellerId !== preSellerId) {
    return null;
  }
  return detail;
};

// List a user's own BOQs, newest first.
export const getUserBoqs = async (userUuid: string): Promise<SelectBoqs[]> =>
  db
    .select()
    .from(Boqs)
    .where(eq(Boqs.userUuid, userUuid))
    .orderBy(desc(Boqs.createdAt));

// Attach item count and subtotal (summed from BoqItems) to each BOQ, keying the
// aggregate to just these BOQs instead of scanning the whole table.
const attachBoqTotals = async <T extends { uuid: string }>(
  boqs: T[],
): Promise<(T & { itemCount: number; subtotal: number })[]> => {
  if (boqs.length === 0) {
    return [];
  }

  const totals = await db
    .select({
      boqUuid: BoqItems.boqUuid,
      itemCount: sql<number>`sum(${BoqItems.quantity})`,
      subtotal: sql<number>`sum(${BoqItems.unitPrice} * ${BoqItems.quantity})`,
    })
    .from(BoqItems)
    .where(
      inArray(
        BoqItems.boqUuid,
        boqs.map((boq) => boq.uuid),
      ),
    )
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

// List every BOQ with the customer's name and totals, newest first.
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

// Assign a BOQ to a pre-seller for review, or unassign it when given null.
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

// List the BOQs assigned to a pre-seller, with customer name and totals.
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

// Load a BOQ that belongs to this pre-seller and is still a draft, else throw.
const loadAssignedDraftBoq = async (
  preSellerId: string,
  boqUuid: string,
  executor: DbExecutor = db,
): Promise<SelectBoqs> => {
  const [boq] = await executor
    .select()
    .from(Boqs)
    .where(
      and(eq(Boqs.uuid, boqUuid), eq(Boqs.assignedPreSellerId, preSellerId)),
    );
  if (!boq) {
    throw new ValidationError("BOQ not found");
  }
  if (boq.status !== "draft") {
    throw new ConflictError("This BOQ has already been submitted");
  }
  return boq;
};

// Look up the location a BOQ's customer set on their profile.
const getCustomerLocation = async (
  userUuid: string,
  executor: DbExecutor = db,
): Promise<string | null> => {
  const [customer] = await executor
    .select({ location: Users.location })
    .from(Users)
    .where(eq(Users.uuid, userUuid));
  return customer?.location ?? null;
};

// Partner options for a draft BOQ: same-city matches to auto-suggest, plus the
// rest of the approved partners to hand-pick from.
export const getBoqPartnerOptions = async ({
  preSellerId,
  boqUuid,
}: {
  preSellerId: string;
  boqUuid: string;
}): Promise<BoqPartnerOptions> => {
  const boq = await loadAssignedDraftBoq(preSellerId, boqUuid);
  const location = await getCustomerLocation(boq.userUuid);

  return getApprovedPartnerOptions(location);
};

// Submit a draft BOQ to the selected partners and mark it submitted — guard,
// reads and writes all in one transaction.
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
}): Promise<SubmitBoqResult> =>
  db.transaction(async (tx) => {
    const boq = await loadAssignedDraftBoq(preSellerId, boqUuid, tx);

    const [firstItem] = await tx
      .select({ id: BoqItems.id })
      .from(BoqItems)
      .where(eq(BoqItems.boqUuid, boqUuid))
      .limit(1);
    if (!firstItem) {
      throw new ValidationError("Add at least one item before submitting");
    }

    const location = await getCustomerLocation(boq.userUuid, tx);
    const options = await getApprovedPartnerOptions(location, tx);
    const selectedIds = new Set(partnerClerkUserIds);
    const otherById = new Map(
      options.others.map((partner) => [partner.clerkUserId, partner]),
    );
    const selectedClose = options.close.filter((partner) =>
      selectedIds.has(partner.clerkUserId),
    );
    const selectedOthers = partnerClerkUserIds.flatMap((id) => {
      const partner = otherById.get(id);
      return partner ? [partner] : [];
    });
    const partners = [...selectedClose, ...selectedOthers];
    if (partners.length === 0) {
      throw new ValidationError("Select at least one partner to send this BOQ to");
    }

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

    const [updated] = await tx.select().from(Boqs).where(eq(Boqs.id, boq.id));
    if (!updated) {
      throw new Error("Failed to submit BOQ");
    }
    return { boq: updated, partners };
  });

// List the partners a submitted BOQ was dispatched to, closest match first.
export const getBoqPartners = async (
  boqUuid: string,
): Promise<SelectBoqPartners[]> =>
  db
    .select()
    .from(BoqPartners)
    .where(eq(BoqPartners.boqUuid, boqUuid))
    .orderBy(asc(BoqPartners.matchRank));

// List the BOQs dispatched to a partner, most recently dispatched first.
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

// Load one dispatched BOQ for a partner — its items plus the pre-seller's note
// — or null if it wasn't dispatched to them.
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
  if (!link) {
    return null;
  }

  const detail = await getBoq(boqUuid);
  if (!detail) {
    return null;
  }

  return { ...detail, preSellerComment: link.preSellerComment };
};
