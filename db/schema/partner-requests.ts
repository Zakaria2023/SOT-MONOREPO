import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
// partnerBadges powers the one discount ladder (see BADGE_DISCOUNTS).
import { partnerBadges, partnerRequestStatuses, partnerTypes } from "../enum";

// Partners can't self-serve a login — every type submits a request that an
// admin reviews. On approval the admin sends a Clerk invitation to the email
// and the webhook builds a "partner" Users row on acceptance. The type-specific
// fields mirror the client sign-up (Users table). Mirrors GovernmentRequests.
export const PartnerRequests = mysqlTable(
  "PartnerRequests",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    // What the partner can do — chosen first, one or more (stock, install +
    // program, install only, pre-sell, post-sell). Stored as a JSON array.
    capabilities: json("capabilities").$type<string[]>(),

    // Which sign-up-style applicant this is; drives the type-specific fields.
    type: mysqlEnum("type", partnerTypes).notNull(),

    // Shared contact identity (every type). fullName is composed — the name
    // parts for individuals, the representative name for facilities.
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    contactNumber: varchar("contact_number", { length: 30 }).notNull(),
    location: varchar("location", { length: 255 }).notNull(),

    // ── Individual fields (null for facilities) ───────────────────────────
    firstName: varchar("first_name", { length: 255 }),
    middleName: varchar("middle_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),

    // ── Facility fields (null for individuals) ────────────────────────────
    companyName: varchar("company_name", { length: 255 }),
    unifiedNumber: varchar("unified_number", { length: 30 }),
    crNumber: varchar("cr_number", { length: 30 }),
    vatNumber: varchar("vat_number", { length: 30 }),
    nationalAddress: text("national_address"),
    // R2 document ids for the uploaded certificates.
    crCertificate: varchar("cr_certificate", { length: 64 }),
    vatCertificate: varchar("vat_certificate", { length: 64 }),
    representativeName: varchar("representative_name", { length: 255 }),

    // The partner's delivery scope. Not asked on the request form — every new
    // partner starts at full scope; the offers flow gates programming pricing
    // on it ("install-program" may quote programming, "installation" may not).
    serviceScope: varchar("service_scope", { length: 50 })
      .default("install-program")
      .notNull(),

    // The partner's tier on the discount ladder. Every new partner starts as a
    // reseller; an admin can promote them. Drives both their buy-in price and
    // the margin pool (one number, see BADGE_DISCOUNTS).
    badge: mysqlEnum("badge", partnerBadges).default("reseller").notNull(),

    // Integrated partners (accounting system bound to SOT) are auto-invoiced
    // and paid the instant handover completes; non-integrated partners submit a
    // manual invoice and wait. Integration is the faster-paid path.
    isIntegrated: boolean("is_integrated").default(false).notNull(),

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
    // getApprovedPartnerByClerkId resolves every partner request by this column.
    index("idx_partner_requests_approved_clerk_user_id").on(
      table.approvedClerkUserId,
    ),
  ],
);

export type SelectPartnerRequests = InferSelectModel<typeof PartnerRequests>;
export type InsertPartnerRequests = InferInsertModel<typeof PartnerRequests>;
