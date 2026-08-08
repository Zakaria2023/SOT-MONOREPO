import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  like,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../../../db";
import type { UserType } from "../../../db/enum";
import { Boqs, type SelectBoqs } from "../../../db/schema/boqs";
import { CartItems, Carts } from "../../../db/schema/carts";
import { ExpertRequests } from "../../../db/schema/expert-requests";
import { Invoices, Orders, type SelectOrders } from "../../../db/schema/orders";
import { PartnerCapabilityLog } from "../../../db/schema/partner-capability-log";
import { PartnerRequests } from "../../../db/schema/partner-requests";
import { Products } from "../../../db/schema/products";
import { Users, type SelectUsers } from "../../../db/schema/users";

// ---------------------------------------------------------------------------
// EVERYTHING ABOUT ONE PERSON.
//
// The question this answers is the one support actually gets: "this customer
// rang about their order — who are they, what have they bought, what is sitting
// in their basket, and what has happened to their account?" Answering it used to
// mean four separate screens and a database client.
//
// Assembled from what already exists rather than from a new table. A person's
// history IS their orders, their BOQs, their basket and the decisions taken
// about them — duplicating that into a "user activity" log would create a second
// version of the truth that drifts from the first.
//
// COUNTS ARE AGGREGATED IN SQL, NEVER BY FETCHING AND COUNTING. The list screen
// shows every user with their order and BOQ totals, and one query per row would
// be a query per user against a pool with a hard connection ceiling.
// ---------------------------------------------------------------------------

export type AdminUserRow = SelectUsers & {
  orderCount: number;
  boqCount: number;
  cartItemCount: number;
  // Null when they have never been a partner. The status matters as much as the
  // existence: a rejected application is a different fact from no application.
  partnerStatus: string | null;
};

export type UserOrderRow = SelectOrders & {
  itemCount: number;
  invoiceNumber: string | null;
};

export type UserCartLine = {
  uuid: string;
  productUuid: string;
  // Null when the product has been deleted since it was added. Surfaced rather
  // than coalesced to a placeholder here: the screen decides how to say "this is
  // gone", and a service that invents a name hides that it happened.
  name: string | null;
  quantity: number;
  unitPrice: string | null;
  currency: string | null;
  addedAt: Date;
};

// One thing that happened, from whichever table recorded it. Merged into a
// single timeline because "what happened to this account" is one question, and
// answering it with five lists makes the reader do the sorting.
export type UserEvent = {
  at: Date;
  kind: "order" | "boq" | "partner" | "expert";
  summary: string;
  detail: string | null;
};

export type AdminUserDetail = {
  user: SelectUsers;
  orders: UserOrderRow[];
  boqs: SelectBoqs[];
  cart: UserCartLine[];
  events: UserEvent[];
  partner: {
    status: string;
    capabilities: string[];
    isIntegrated: boolean;
  } | null;
};

const searchFilter = (search?: string) => {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }
  const pattern = `%${term}%`;
  return or(
    like(Users.fullName, pattern),
    like(Users.email, pattern),
    like(Users.phone, pattern),
    like(Users.companyName, pattern),
  );
};

/**
 * The user list, with totals.
 *
 * Every count is a correlated sub-select, table-qualified. Bare column names in
 * a correlated sub-query resolve to the SUB-query's own columns in MySQL and
 * return the wrong number without erroring — a lesson this codebase has already
 * learned once, on the import queue.
 */
export const listUsersPage = async ({
  search,
  limit,
  offset,
  type,
}: {
  search?: string;
  limit: number;
  offset: number;
  type?: UserType;
}): Promise<{ items: AdminUserRow[]; total: number }> => {
  const filters = [searchFilter(search), type ? eq(Users.type, type) : undefined]
    .filter((filter) => filter !== undefined)
    .flatMap((filter) => (filter ? [filter] : []));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [items, [totals]] = await Promise.all([
    db
      .select({
        ...getUserColumns(),
        orderCount: sql<number>`(SELECT COUNT(*) FROM ${Orders} o WHERE o.user_uuid = \`Users\`.\`uuid\`)`,
        boqCount: sql<number>`(SELECT COUNT(*) FROM ${Boqs} b WHERE b.user_uuid = \`Users\`.\`uuid\`)`,
        cartItemCount: sql<number>`(
          SELECT COALESCE(SUM(ci.quantity), 0)
          FROM ${CartItems} ci
          JOIN ${Carts} c ON c.uuid = ci.cart_uuid
          WHERE c.user_uuid = \`Users\`.\`uuid\`)`,
        partnerStatus: sql<
          string | null
        >`(SELECT pr.status FROM ${PartnerRequests} pr WHERE pr.approved_clerk_user_id = \`Users\`.\`clerk_user_id\` LIMIT 1)`,
      })
      .from(Users)
      .where(where)
      .orderBy(desc(Users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(Users).where(where),
  ]);

  return { items, total: totals?.total ?? 0 };
};

// Spelled out rather than `getTableColumns` so the shape is visible at the call
// site — this row goes to a screen that shows most of it.
const getUserColumns = () => ({
  id: Users.id,
  uuid: Users.uuid,
  clerkUserId: Users.clerkUserId,
  type: Users.type,
  fullName: Users.fullName,
  firstName: Users.firstName,
  middleName: Users.middleName,
  lastName: Users.lastName,
  email: Users.email,
  phone: Users.phone,
  companyName: Users.companyName,
  location: Users.location,
  image: Users.image,
  unifiedNumber: Users.unifiedNumber,
  crNumber: Users.crNumber,
  vatNumber: Users.vatNumber,
  nationalAddress: Users.nationalAddress,
  crCertificate: Users.crCertificate,
  vatCertificate: Users.vatCertificate,
  representativeName: Users.representativeName,
  representativeMobile: Users.representativeMobile,
  representativeEmail: Users.representativeEmail,
  createdAt: Users.createdAt,
  updatedAt: Users.updatedAt,
});

/**
 * One person, and everything attached to them.
 *
 * Six queries fired together rather than in sequence: they share nothing, and
 * run serially they would add five round trips to a page that already waited for
 * the first.
 */
export const getAdminUserDetail = async (
  uuid: string,
): Promise<AdminUserDetail | null> => {
  const [user] = await db.select().from(Users).where(eq(Users.uuid, uuid));
  if (!user) {
    return null;
  }

  const [orders, boqs, cart, partnerRow, capabilityLog, expertRows] =
    await Promise.all([
      db
        .select({
          // Every column, from the table. Listing them by hand silently dropped
          // three the day they were added — and a screen that shows "everything
          // about a user" is exactly where that goes unnoticed.
          ...getTableColumns(Orders),
          itemCount: sql<number>`(SELECT COALESCE(SUM(oi.quantity), 0) FROM OrderItems oi WHERE oi.order_uuid = \`Orders\`.\`uuid\`)`,
          invoiceNumber: sql<
            string | null
          >`(SELECT i.number FROM ${Invoices} i WHERE i.order_uuid = \`Orders\`.\`uuid\` LIMIT 1)`,
        })
        .from(Orders)
        .where(eq(Orders.userUuid, uuid))
        .orderBy(desc(Orders.createdAt)),

      db
        .select()
        .from(Boqs)
        .where(eq(Boqs.userUuid, uuid))
        .orderBy(desc(Boqs.createdAt)),

      db
        .select({
          uuid: CartItems.uuid,
          productUuid: CartItems.productUuid,
          name: Products.name,
          quantity: CartItems.quantity,
          unitPrice: Products.price,
          currency: Products.currency,
          addedAt: CartItems.createdAt,
        })
        .from(CartItems)
        .innerJoin(Carts, eq(Carts.uuid, CartItems.cartUuid))
        .leftJoin(Products, eq(Products.uuid, CartItems.productUuid))
        .where(eq(Carts.userUuid, uuid)),

      db
        .select()
        .from(PartnerRequests)
        .where(eq(PartnerRequests.approvedClerkUserId, user.clerkUserId)),

      db
        .select()
        .from(PartnerCapabilityLog)
        .innerJoin(
          PartnerRequests,
          eq(PartnerRequests.uuid, PartnerCapabilityLog.partnerUuid),
        )
        .where(eq(PartnerRequests.approvedClerkUserId, user.clerkUserId)),

      db
        .select()
        .from(ExpertRequests)
        .where(eq(ExpertRequests.askedByClerkUserId, user.clerkUserId)),
    ]);

  const partner = partnerRow[0] ?? null;

  // Merged and sorted here rather than in SQL: five UNIONed tables with
  // different shapes is a query nobody can read or change, and the volumes are
  // one person's history.
  const events: UserEvent[] = [
    ...orders.map((order) => ({
      at: order.createdAt,
      kind: "order" as const,
      summary: `Ordered ${order.reference}`,
      detail: `${order.grandTotal} ${order.currency ?? "SAR"} · ${order.status}`,
    })),
    ...boqs.map((boq) => ({
      at: boq.createdAt,
      kind: "boq" as const,
      summary: `Raised ${boq.reference}`,
      detail: boq.status,
    })),
    ...capabilityLog.map((row) => ({
      at: row.PartnerCapabilityLog.createdAt,
      kind: "partner" as const,
      summary: `${row.PartnerCapabilityLog.action === "granted" ? "Given" : "Lost"} ${row.PartnerCapabilityLog.capability}`,
      detail: row.PartnerCapabilityLog.reason,
    })),
    ...expertRows.map((request) => ({
      at: request.createdAt,
      kind: "expert" as const,
      summary: `Asked: ${request.subject}`,
      detail: request.status,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    user,
    orders,
    boqs,
    cart,
    events,
    partner: partner
      ? {
          status: partner.status,
          capabilities: partner.capabilities ?? [],
          isIntegrated: partner.isIntegrated,
        }
      : null,
  };
};
