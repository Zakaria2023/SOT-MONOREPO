import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// A group in the master spec library (Power, Connectivity, Physical, ...).
// Purely organizational: keeps the library manageable as it grows. A
// specification may belong to at most one group.
export const SpecificationGroups = mysqlTable("SpecificationGroups", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  name: varchar("name", { length: 255 }).notNull(),
  order: int("order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectSpecificationGroups = InferSelectModel<
  typeof SpecificationGroups
>;
export type InsertSpecificationGroups = InferInsertModel<
  typeof SpecificationGroups
>;
