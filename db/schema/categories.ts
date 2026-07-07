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
} from "drizzle-orm/mysql-core";

export type CategoryHighlight = {
  k: string;
  v: string;
};

export type CategorySpecGroup = {
  title: string;
  rows: { k: string; v: string }[];
};

export const Categories = mysqlTable(
  "Categories",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    parentUuid: char("parent_uuid", { length: 36 }),

    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    order: int("order").default(0).notNull(),

    image: varchar("image", { length: 255 }),

    // Default spec structure inherited by products assigned to this category.
    highlights: json("highlights").$type<CategoryHighlight[]>(),
    specGroups: json("spec_groups").$type<CategorySpecGroup[]>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_categories_parent_uuid").on(table.parentUuid)],
);

export type SelectCategories = InferSelectModel<typeof Categories>;
export type InsertCategories = InferInsertModel<typeof Categories>;
