import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  json,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// A reusable bundle of attributes for a product TYPE (e.g. "IP camera (dome,
// PoE)"). Stores attribute KEYS, not rows, so renaming/re-optioning an
// attribute keeps every template that uses it current. Applied to a product to
// pre-fill which attributes it carries.
export const SpecificationTemplates = mysqlTable("SpecificationTemplates", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  name: varchar("name", { length: 255 }).notNull(),
  // Ordered spec keys (Specifications.key) this template bundles.
  attributeKeys: json("attribute_keys").$type<string[]>().notNull(),

  order: int("order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectSpecificationTemplates = InferSelectModel<
  typeof SpecificationTemplates
>;
export type InsertSpecificationTemplates = InferInsertModel<
  typeof SpecificationTemplates
>;
