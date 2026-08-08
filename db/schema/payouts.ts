import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { partnerEarningStatuses, partnerPayoutStatuses } from "../enum";
import { Orders } from "./orders";

// A partner earning is a PAYABLE — money SOT OWES the partner for a verified
// service — NOT a wallet balance SOT holds on their behalf. The distinction is
// legally meaningful (a stored balance can attract SAMA attention), so this
// table models an amount owed against a verified order, cleared when SOT pays
// out against the partner's invoice. It never represents custodied funds.
export const PartnerEarnings = mysqlTable(
  "PartnerEarnings",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    partnerClerkUserId: varchar("partner_clerk_user_id", {
      length: 64,
    }).notNull(),
    // The order whose verified handover accrued this payable.
    orderUuid: char("order_uuid", { length: 36 })
      .notNull()
      .references(() => Orders.uuid, { onDelete: "restrict" }),

    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).default("SAR"),

    status: mysqlEnum("status", partnerEarningStatuses)
      .default("accrued")
      .notNull(),

    // The payout that cleared this earning, once cashed out.
    payoutUuid: char("payout_uuid", { length: 36 }),

    accruedAt: timestamp("accrued_at").defaultNow().notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_partner_earnings_partner").on(table.partnerClerkUserId),
    index("idx_partner_earnings_order_uuid").on(table.orderUuid),
    index("idx_partner_earnings_status").on(table.status),
  ],
);

// A cash-out. The partner raises a ZATCA-clean invoice covering their accrued
// earnings; SOT transfers via a licensed payment provider. Integrated partners
// get this auto-created and paid the instant handover completes.
export const PartnerPayouts = mysqlTable(
  "PartnerPayouts",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),
    reference: varchar("reference", { length: 50 }).notNull(),

    partnerClerkUserId: varchar("partner_clerk_user_id", {
      length: 64,
    }).notNull(),

    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).default("SAR"),

    status: mysqlEnum("status", partnerPayoutStatuses)
      .default("requested")
      .notNull(),

    // R2 document id of the partner's uploaded invoice (manual path).
    invoiceDocument: varchar("invoice_document", { length: 64 }),
    // True when raised automatically for an integrated partner at handover.
    auto: boolean("auto").default(false).notNull(),

    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),

    // The bank's reference for the transfer, and who recorded it. SOT does not
    // move the money — a person does, through a bank — and this row is the
    // ledger catching up with that. A row marked paid with nothing to check it
    // against cannot be reconciled against a statement, which is the only thing
    // that makes it true.
    paidReference: varchar("paid_reference", { length: 100 }),
    paidBy: varchar("paid_by", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_partner_payouts_partner").on(table.partnerClerkUserId),
    index("idx_partner_payouts_status").on(table.status),
  ],
);

export type SelectPartnerEarnings = InferSelectModel<typeof PartnerEarnings>;
export type InsertPartnerEarnings = InferInsertModel<typeof PartnerEarnings>;
export type SelectPartnerPayouts = InferSelectModel<typeof PartnerPayouts>;
export type InsertPartnerPayouts = InferInsertModel<typeof PartnerPayouts>;
