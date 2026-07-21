import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  like,
  or,
  sql,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { BoqStatus } from "../../../db/enum";
import {
  BoqPartners,
  SelectBoqPartners,
} from "../../../db/schema/boq-partners";
import {
  BoqItems,
  BoqSections,
  Boqs,
  SelectBoqItems,
  SelectBoqs,
  SelectBoqSections,
} from "../../../db/schema/boqs";
import { Brands, SelectBrands } from "../../../db/schema/brands";
import { CartItems, Carts } from "../../../db/schema/carts";
import { Categories } from "../../../db/schema/categories";
import { Products, SelectProducts } from "../../../db/schema/products";
import { SelectUsers, Users } from "../../../db/schema/users";
import { checkCompatibility } from "./check-compatibility";
import { ConflictError, ValidationError } from "./errors";
import { checkBoqPresence } from "./presence-rules";
import type { PresenceFinding } from "./presence-engine";
import type { CompatibilityReport } from "./rule-engine";
import {
  getApprovedPartnerOptions,
  type BoqPartnerOptions,
  type DbExecutor,
  type MatchedPartner,
} from "./partners";

export type { SelectBoqItems, SelectBoqs, SelectBoqSections };

export type BoqDetail = {
  boq: SelectBoqs;
  sections: SelectBoqSections[];
  items: SelectBoqItems[];
};

export type ValidateBoqResult = {
  boq: SelectBoqs;
  report: CompatibilityReport;
  // Requires-companion findings (what's MISSING from the design). Hard findings
  // block validation just like a compatibility failure; soft ones only warn.
  presenceFindings: PresenceFinding[];
  validated: boolean;
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

// A BOQ line enriched with the live product's fields (for the admin detail
// view). Left-joined, so every product-backed column is nullable; service
// lines have no product at all.
export type AdminBoqItem = SelectBoqItems & {
  productImage: SelectProducts["image"] | null;
  productSku: SelectProducts["sku"] | null;
  productModel: SelectProducts["model"] | null;
  productSlug: SelectProducts["slug"] | null;
  productStatus: SelectProducts["status"] | null;
  productPrice: SelectProducts["price"] | null;
  brandName: SelectBrands["name"] | null;
};

export type AdminBoqDetail = {
  boq: SelectBoqs;
  customerName: SelectUsers["fullName"] | null;
  sections: SelectBoqSections[];
  items: AdminBoqItem[];
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
      systemRole: Products.systemRole,
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
  // One solution = one category = one system, so the whole BOQ is a single
  // section named after that system.
  const sectionUuid = randomUUID();
  const [firstLine] = lines;
  const sectionName = firstLine?.categoryName ?? "System";

  return db.transaction(async (tx) => {
    await tx.insert(Boqs).values({ uuid: boqUuid, userUuid, reference });
    await tx
      .insert(BoqSections)
      .values({ uuid: sectionUuid, boqUuid, name: sectionName, order: 0 });
    await tx.insert(BoqItems).values(
      lines.map((line) => ({
        uuid: randomUUID(),
        boqUuid,
        sectionUuid,
        productUuid: line.productUuid,
        lineType: "product" as const,
        role: line.systemRole,
        name: line.name,
        categoryName: line.categoryName,
        unitPrice: line.unitPrice ?? "0",
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
  const sections = await db
    .select()
    .from(BoqSections)
    .where(eq(BoqSections.boqUuid, boqUuid))
    .orderBy(asc(BoqSections.order));

  return { boq: first.boq, sections, items };
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

// Run the compatibility rules over a draft BOQ (stage 2, "validated"). A
// blocking failure keeps it a draft and returns the report so the customer can
// fix it; a clean pass promotes it to `validated`. Phase 1: a human still
// confirms downstream — this feeds validation, it is not the final authority.
export const validateBoq = async (
  userUuid: string,
  boqUuid: string,
): Promise<ValidateBoqResult> => {
  const detail = await getUserBoq(userUuid, boqUuid);
  if (!detail) {
    throw new ValidationError("BOQ not found");
  }
  if (detail.boq.status !== "draft") {
    throw new ConflictError("This BOQ has already been validated");
  }

  const selection = detail.items.flatMap((item) =>
    item.productUuid
      ? [{ productUuid: item.productUuid, quantity: item.quantity }]
      : [],
  );
  const [report, presence] = await Promise.all([
    checkCompatibility(selection),
    checkBoqPresence(boqUuid),
  ]);
  // The purchase gate: a clean pass needs both no compatibility failures and no
  // HARD requires-companion gaps (a camera with no recorder, etc.).
  const validated = report.failures === 0 && !presence.gate.blocked;

  if (validated) {
    await db
      .update(Boqs)
      .set({ status: "validated" })
      .where(eq(Boqs.uuid, boqUuid));
  }

  const [boq] = await db.select().from(Boqs).where(eq(Boqs.uuid, boqUuid));
  if (!boq) {
    throw new Error("Failed to load BOQ after validation");
  }
  return { boq, report, presenceFindings: presence.findings, validated };
};

// The fulfilment stages, in order — the Service & Handover progression. Each
// call may only move a BOQ to the immediately next stage.
const FULFILMENT_ORDER: BoqStatus[] = [
  "ordered",
  "assigned",
  "installing",
  "installed",
  "verified",
  "handed_over",
];

// Advance a BOQ one fulfilment stage forward (assigned → … → handed_over),
// rejecting skips and backward moves so the lifecycle can't jump states.
export const advanceBoqFulfilment = async (
  boqUuid: string,
  next: BoqStatus,
): Promise<SelectBoqs> => {
  const [boq] = await db.select().from(Boqs).where(eq(Boqs.uuid, boqUuid));
  if (!boq) {
    throw new ValidationError("BOQ not found");
  }

  const currentIndex = FULFILMENT_ORDER.indexOf(boq.status ?? "draft");
  const nextIndex = FULFILMENT_ORDER.indexOf(next);
  if (nextIndex <= 0 || nextIndex !== currentIndex + 1) {
    throw new ConflictError(
      `A BOQ at "${boq.status}" can't move to "${next}"`,
    );
  }

  await db.update(Boqs).set({ status: next }).where(eq(Boqs.uuid, boqUuid));
  const [updated] = await db.select().from(Boqs).where(eq(Boqs.uuid, boqUuid));
  if (!updated) {
    throw new Error("Failed to advance BOQ");
  }
  return updated;
};

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
      // MySQL returns SUM() as a decimal string — map it to a real number.
      itemCount: sql<number>`sum(${BoqItems.quantity})`.mapWith(Number),
      subtotal: sql<number>`sum(${BoqItems.unitPrice} * ${BoqItems.quantity})`.mapWith(
        Number,
      ),
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

export type BoqsListParams = {
  search?: string;
  limit: number;
  offset: number;
};

/**
 * A searched + paginated page of BOQs, each with the customer's name and
 * totals (newest first), plus the unfiltered total for that search. Search
 * matches the BOQ reference or the customer name.
 */
export const getAllBoqs = async (
  params: BoqsListParams,
): Promise<{ items: BoqListItem[]; total: number }> => {
  const term = params.search?.trim();
  const where = term
    ? or(like(Boqs.reference, `%${term}%`), like(Users.fullName, `%${term}%`))
    : undefined;

  const [boqs, [totals]] = await Promise.all([
    db
      .select({
        ...getTableColumns(Boqs),
        customerName: Users.fullName,
      })
      .from(Boqs)
      .leftJoin(Users, eq(Boqs.userUuid, Users.uuid))
      .where(where)
      .orderBy(desc(Boqs.createdAt))
      .limit(params.limit)
      .offset(params.offset),
    db
      .select({ total: count() })
      .from(Boqs)
      .leftJoin(Users, eq(Boqs.userUuid, Users.uuid))
      .where(where),
  ]);

  const items = await attachBoqTotals(boqs);
  return { items, total: Number(totals?.total ?? 0) };
};

// Load one BOQ for the admin detail view: the BOQ, its customer, its sections,
// and every line enriched with the live product's fields. Not ownership-scoped
// — admin-only.
export const getAdminBoq = async (
  boqUuid: string,
): Promise<AdminBoqDetail | null> => {
  const [row] = await db
    .select({ boq: getTableColumns(Boqs), customerName: Users.fullName })
    .from(Boqs)
    .leftJoin(Users, eq(Boqs.userUuid, Users.uuid))
    .where(eq(Boqs.uuid, boqUuid));
  if (!row) {
    return null;
  }

  const [items, sections] = await Promise.all([
    db
      .select({
        ...getTableColumns(BoqItems),
        productImage: Products.image,
        productSku: Products.sku,
        productModel: Products.model,
        productSlug: Products.slug,
        productStatus: Products.status,
        productPrice: Products.price,
        brandName: Brands.name,
      })
      .from(BoqItems)
      .leftJoin(Products, eq(BoqItems.productUuid, Products.uuid))
      .leftJoin(Brands, eq(Products.brandUuid, Brands.uuid))
      .where(eq(BoqItems.boqUuid, boqUuid))
      .orderBy(asc(BoqItems.createdAt)),
    db
      .select()
      .from(BoqSections)
      .where(eq(BoqSections.boqUuid, boqUuid))
      .orderBy(asc(BoqSections.order)),
  ]);

  return { boq: row.boq, customerName: row.customerName, sections, items };
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
