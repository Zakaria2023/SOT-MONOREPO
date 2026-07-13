import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const Users = mysqlTable("Users", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  // Identity is owned by Clerk; this links our profile row to the Clerk user.
  // Kept in sync by the Clerk webhook (see apps/client webhooks/clerk route).
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),

  fullName: varchar("full_name", { length: 255 }).notNull(),
  // Users sign up with either an email or a phone, never required to give both,
  // so each identity column is nullable. Clerk enforces their uniqueness.
  email: varchar("email", { length: 255 }).unique(),
  phone: varchar("phone", { length: 30 }).unique(),
  companyName: varchar("company_name", { length: 255 }),
  location: varchar("location", { length: 255 }),

  image: varchar("image", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectUsers = InferSelectModel<typeof Users>;
export type InsertUsers = InferInsertModel<typeof Users>;
