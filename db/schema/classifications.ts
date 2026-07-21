import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// A classification groups categories (solutions) — e.g. "Networking",
// "Security", "Power". Just a name; chosen on a category and used as a
// filter on the client "shop by solution" page.
export const Classifications = mysqlTable("Classifications", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  name: varchar("name", { length: 255 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectClassifications = InferSelectModel<typeof Classifications>;
export type InsertClassifications = InferInsertModel<typeof Classifications>;
