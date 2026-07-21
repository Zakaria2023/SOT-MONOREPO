import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { invoiceStatuses, orderStatuses } from "../enum";
import { Boqs } from "./boqs";
import { Offers } from "./offers";
import { Users } from "./users";

// An order is a confirmed purchase. It comes from one of two paths: a BOQ offer
// the customer selected (confirm-then-pay — boqUuid + offerUuid set), or a
// direct product order shopped straight from the catalog (both null, with line
// items in OrderItems). Totals are stored, not recomputed, so the agreed price
// can't drift if catalog prices change later.
export const Orders = mysqlTable(
  "Orders",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),
    reference: varchar("reference", { length: 50 }).notNull(),

    // Both null for a direct (non-BOQ) product order.
    boqUuid: char("boq_uuid", { length: 36 }).references(() => Boqs.uuid, {
      onDelete: "restrict",
    }),
    offerUuid: char("offer_uuid", { length: 36 }).references(
      () => Offers.uuid,
      { onDelete: "restrict" },
    ),
    userUuid: char("user_uuid", { length: 36 })
      .notNull()
      .references(() => Users.uuid, { onDelete: "restrict" }),

    status: mysqlEnum("status", orderStatuses)
      .default("awaiting_payment")
      .notNull(),

    // The partner discount applied to a direct order (0 for BOQ/regular orders).
    discountPercent: int("discount_percent").default(0).notNull(),

    // Agreed totals snapshotted at confirm time.
    productTotal: decimal("product_total", {
      precision: 12,
      scale: 2,
    }).notNull(),
    serviceTotal: decimal("service_total", {
      precision: 12,
      scale: 2,
    }).notNull(),
    grandTotal: decimal("grand_total", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).default("SAR"),

    confirmedAt: timestamp("confirmed_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),
    cancelledAt: timestamp("cancelled_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_orders_boq_uuid").on(table.boqUuid),
    index("idx_orders_offer_uuid").on(table.offerUuid),
    index("idx_orders_user_uuid").on(table.userUuid),
    index("idx_orders_status").on(table.status),
  ],
);

// An invoice is raised only for a confirmed order, once, when payment lands.
export const Invoices = mysqlTable(
  "Invoices",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),
    number: varchar("number", { length: 50 }).notNull().unique(),

    orderUuid: char("order_uuid", { length: 36 })
      .notNull()
      .references(() => Orders.uuid, { onDelete: "restrict" }),

    status: mysqlEnum("status", invoiceStatuses).default("issued").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).default("SAR"),

    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_invoices_order_uuid").on(table.orderUuid)],
);

export type SelectOrders = InferSelectModel<typeof Orders>;
export type InsertOrders = InferInsertModel<typeof Orders>;
export type SelectInvoices = InferSelectModel<typeof Invoices>;
export type InsertInvoices = InferInsertModel<typeof Invoices>;
