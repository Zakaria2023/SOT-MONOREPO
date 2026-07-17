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
import { governmentRequestStatuses } from "../enum";

// Government entities can't self-serve a login — they submit a request that an
// admin reviews. On approval the admin sends a Clerk invitation to the official
// email. Mirrors PartnerRequests.
export const GovernmentRequests = mysqlTable(
  "GovernmentRequests",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    officialEmail: varchar("official_email", { length: 255 }).notNull(),
    entityName: varchar("entity_name", { length: 255 }).notNull(),
    // The contact person submitting on the entity's behalf.
    fullName: varchar("full_name", { length: 255 }).notNull(),
    // Official email is the required identifier; phone is optional.
    contactNumber: varchar("contact_number", { length: 30 }),
    location: varchar("location", { length: 255 }).notNull(),

    status: mysqlEnum("status", governmentRequestStatuses)
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
    index("idx_government_requests_email").on(table.officialEmail),
    index("idx_government_requests_status").on(table.status),
    index("idx_government_requests_created_at").on(table.createdAt),
  ],
);

export type SelectGovernmentRequests = InferSelectModel<
  typeof GovernmentRequests
>;
export type InsertGovernmentRequests = InferInsertModel<
  typeof GovernmentRequests
>;
