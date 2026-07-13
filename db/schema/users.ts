import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { userTypes } from "../enum";

export const Users = mysqlTable("Users", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  // Identity is owned by Clerk; this links our profile row to the Clerk user.
  // Kept in sync by the Clerk webhook (see apps/client webhooks/clerk route).
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),

  // Which set of fields below applies. Drives the sign-up form and shows/hides
  // the type-specific columns. Null means "not chosen yet" — e.g. a social
  // sign-up that must still pick a type on the complete-profile screen.
  type: mysqlEnum("type", userTypes),

  // Display name (composed). For individuals we also keep the parts.
  fullName: varchar("full_name", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 255 }),
  middleName: varchar("middle_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),

  // Users sign up with either an email or a phone, never required to give both,
  // so each identity column is nullable. Clerk enforces their uniqueness. For a
  // "government" user these hold the official email / contact number.
  email: varchar("email", { length: 255 }).unique(),
  phone: varchar("phone", { length: 30 }).unique(),
  // For "government" users this holds the entity name.
  companyName: varchar("company_name", { length: 255 }),
  location: varchar("location", { length: 255 }),

  image: varchar("image", { length: 255 }),

  // ── Private Facility fields (null for other types) ───────────────────────
  unifiedNumber: varchar("unified_number", { length: 30 }),
  crNumber: varchar("cr_number", { length: 30 }),
  vatNumber: varchar("vat_number", { length: 30 }),
  nationalAddress: text("national_address"),
  // R2 document ids for the uploaded certificates.
  crCertificate: varchar("cr_certificate", { length: 64 }),
  vatCertificate: varchar("vat_certificate", { length: 64 }),
  representativeName: varchar("representative_name", { length: 255 }),
  representativeMobile: varchar("representative_mobile", { length: 30 }),
  representativeEmail: varchar("representative_email", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectUsers = InferSelectModel<typeof Users>;
export type InsertUsers = InferInsertModel<typeof Users>;
