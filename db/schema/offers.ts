import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { offerStatuses } from "../../apps/admin/src/lib/enum";

// A partner's priced offer against a dispatched BOQ. The partner is a Clerk
// user, so their name/scope are denormalized here. programmingPrice is null
// for installation-only partners.
export const Offers = mysqlTable(
  "Offers",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    boqUuid: char("boq_uuid", { length: 36 }).notNull(),

    partnerClerkUserId: varchar("partner_clerk_user_id", {
      length: 64,
    }).notNull(),
    partnerRequestUuid: char("partner_request_uuid", { length: 36 }),
    partnerName: varchar("partner_name", { length: 255 }),
    serviceScope: varchar("service_scope", { length: 50 }).notNull(),

    productPrice: decimal("product_price", { precision: 12, scale: 2 })
      .notNull(),
    installPrice: decimal("install_price", { precision: 12, scale: 2 })
      .notNull(),
    programmingPrice: decimal("programming_price", { precision: 12, scale: 2 }),
    currency: char("currency", { length: 3 }).default("SAR"),

    description: text("description").notNull(),

    status: mysqlEnum("status", offerStatuses).default("pending").notNull(),
    rejectionReason: text("rejection_reason"),

    reviewedByClerkUserId: varchar("reviewed_by_clerk_user_id", { length: 64 }),
    reviewedByName: varchar("reviewed_by_name", { length: 255 }),

    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    selectedAt: timestamp("selected_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_offers_boq_uuid").on(table.boqUuid),
    index("idx_offers_partner").on(table.partnerClerkUserId),
    index("idx_offers_status").on(table.status),
    unique("uq_offers_boq_partner").on(
      table.boqUuid,
      table.partnerClerkUserId,
    ),
  ],
);

export type SelectOffers = InferSelectModel<typeof Offers>;
export type InsertOffers = InferInsertModel<typeof Offers>;
