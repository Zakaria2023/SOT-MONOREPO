import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  json,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { SpecOption } from "../types";

// A single specification field (e.g. "PoE") with its dropdown options. Each
// option can reveal nested child fields (the conditional tree) stored as JSON.
// Specifications are assigned to categories via SpecificationCategories and
// apply to those categories and all of their descendants.
export const Specifications = mysqlTable("Specifications", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  label: varchar("label", { length: 255 }).notNull(),
  // Stable key derived from the label — products store chosen values under it.
  key: varchar("key", { length: 255 }).notNull(),
  options: json("options").$type<SpecOption[]>(),

  order: int("order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectSpecifications = InferSelectModel<typeof Specifications>;
export type InsertSpecifications = InferInsertModel<typeof Specifications>;
