import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";
import { Classifications } from "./classifications";

export const Categories = mysqlTable(
  "Categories",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    parentUuid: char("parent_uuid", { length: 36 }).references(
      (): AnyMySqlColumn => Categories.uuid,
      { onDelete: "set null" },
    ),

    // The classification (solution group) this category belongs to. Set null
    // if its classification is deleted — the category simply becomes unfiled.
    classificationUuid: char("classification_uuid", { length: 36 }).references(
      () => Classifications.uuid,
      { onDelete: "set null" },
    ),

    name: varchar("name", { length: 255 }).notNull(),
    // Category code — the [CATEGORY] segment of the smart SKU (e.g. "SW").
    code: varchar("code", { length: 4 }),
    // Hierarchical taxonomy code (e.g. "2.A.2") — the join key the ERP
    // classification and the specification taxonomy share. Distinct from
    // `code`, which is only the 4-char SKU segment; this one mirrors the
    // parent chain and is what assignments are read by in exports and the RAG
    // layer. Nullable while the tree is being coded up.
    path: varchar("path", { length: 32 }),
    description: text("description"),
    order: int("order").default(0).notNull(),

    image: varchar("image", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_categories_parent_uuid").on(table.parentUuid),
    index("idx_categories_classification_uuid").on(table.classificationUuid),
  ],
);

export type SelectCategories = InferSelectModel<typeof Categories>;
export type InsertCategories = InferInsertModel<typeof Categories>;
