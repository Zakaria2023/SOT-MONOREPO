import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";
import { Highlight, SpecGroup } from "../types";

export const Categories = mysqlTable(
  "Categories",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    parentUuid: char("parent_uuid", { length: 36 }).references(
      (): AnyMySqlColumn => Categories.uuid,
      { onDelete: "set null" },
    ),

    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    order: int("order").default(0).notNull(),

    image: varchar("image", { length: 255 }),

    highlights: json("highlights").$type<Highlight[]>(),
    specGroups: json("spec_groups").$type<SpecGroup[]>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_categories_parent_uuid").on(table.parentUuid)],
);

export type SelectCategories = InferSelectModel<typeof Categories>;
export type InsertCategories = InferInsertModel<typeof Categories>;
