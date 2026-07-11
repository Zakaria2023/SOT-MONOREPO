import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { partnerRequestStatuses } from "../enum";

export const PartnerRequests = mysqlTable(
  "PartnerRequests",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    fullName: varchar("full_name", { length: 255 }).notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    location: varchar("location", { length: 255 }),

    about: text("about"),
    offer: text("offer"),
    special: text("special"),
    serviceScope: varchar("service_scope", { length: 50 }).notNull(),

    status: mysqlEnum("status", partnerRequestStatuses)
      .default("pending")
      .notNull(),
    rejectionReason: text("rejection_reason"),

    approvedClerkUserId: varchar("approved_clerk_user_id", { length: 64 }),
    reviewedByClerkUserId: varchar("reviewed_by_clerk_user_id", { length: 64 }),
    reviewedByName: varchar("reviewed_by_name", { length: 255 }),

    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_partner_requests_email").on(table.email),
    index("idx_partner_requests_status").on(table.status),
    index("idx_partner_requests_created_at").on(table.createdAt),
  ],
);

export type SelectPartnerRequests = InferSelectModel<typeof PartnerRequests>;
export type InsertPartnerRequests = InferInsertModel<typeof PartnerRequests>;
