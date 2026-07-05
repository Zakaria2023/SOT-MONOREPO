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

  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 30 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  location: varchar("location", { length: 255 }),

  image: varchar("image", { length: 255 }),
  password: varchar("password", { length: 255 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectUsers = InferSelectModel<typeof Users>;
export type InsertUsers = InferInsertModel<typeof Users>;
