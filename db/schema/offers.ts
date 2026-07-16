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
import { offerPresentationModes, offerStatuses } from "../enum";
import { Boqs } from "./boqs";
import { PartnerRequests } from "./partner-requests";

export const Offers = mysqlTable(
  "Offers",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    boqUuid: char("boq_uuid", { length: 36 })
      .notNull()
      .references(() => Boqs.uuid, { onDelete: "cascade" }),

    partnerClerkUserId: varchar("partner_clerk_user_id", {
      length: 64,
    }).notNull(),
    partnerRequestUuid: char("partner_request_uuid", { length: 36 }).references(
      () => PartnerRequests.uuid,
      { onDelete: "set null" },
    ),
    partnerName: varchar("partner_name", { length: 255 }),
    serviceScope: varchar("service_scope", { length: 50 }).notNull(),

    productPrice: decimal("product_price", {
      precision: 12,
      scale: 2,
    }).notNull(),
    installPrice: decimal("install_price", {
      precision: 12,
      scale: 2,
    }).notNull(),
    programmingPrice: decimal("programming_price", { precision: 12, scale: 2 }),
    currency: char("currency", { length: 3 }).default("SAR"),

    description: text("description").notNull(),

    // How the price is shown to the customer. Presentation only — the money
    // still flows through SOT — except products_only, which is a genuine
    // hardware-only sale with no SOT service and no handover.
    presentationMode: mysqlEnum("presentation_mode", offerPresentationModes)
      .default("itemized")
      .notNull(),

    status: mysqlEnum("status", offerStatuses).default("pending").notNull(),
    rejectionReason: text("rejection_reason"),

    reviewedByClerkUserId: varchar("reviewed_by_clerk_user_id", { length: 64 }),
    reviewedByName: varchar("reviewed_by_name", { length: 255 }),

    // When an approved offer stops being selectable. Null = no expiry set yet.
    expiresAt: timestamp("expires_at"),

    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    selectedAt: timestamp("selected_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_offers_boq_uuid").on(table.boqUuid),
    index("idx_offers_partner_request_uuid").on(table.partnerRequestUuid),
    index("idx_offers_partner").on(table.partnerClerkUserId),
    index("idx_offers_status").on(table.status),
    unique("uq_offers_boq_partner").on(table.boqUuid, table.partnerClerkUserId),
  ],
);

export type SelectOffers = InferSelectModel<typeof Offers>;
export type InsertOffers = InferInsertModel<typeof Offers>;
