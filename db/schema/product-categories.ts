import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  mysqlTable,
  timestamp,
  unique,
} from "drizzle-orm/mysql-core";
import { Categories } from "./categories";
import { Products } from "./products";

// Shared-product rule: a product lives in one home category (Products.categoryUuid)
// and is *linked* into any number of others through this join table — one record,
// many shelves, never copied.
export const ProductCategories = mysqlTable(
  "ProductCategories",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    productUuid: char("product_uuid", { length: 36 })
      .notNull()
      .references(() => Products.uuid, { onDelete: "cascade" }),
    categoryUuid: char("category_uuid", { length: 36 })
      .notNull()
      .references(() => Categories.uuid, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_product_categories_product_uuid").on(table.productUuid),
    index("idx_product_categories_category_uuid").on(table.categoryUuid),
    unique("uq_product_categories_product_category").on(
      table.productUuid,
      table.categoryUuid,
    ),
  ],
);

export type SelectProductCategories = InferSelectModel<typeof ProductCategories>;
export type InsertProductCategories = InferInsertModel<typeof ProductCategories>;
