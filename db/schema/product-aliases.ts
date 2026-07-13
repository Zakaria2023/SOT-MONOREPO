import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { aliasTermTypes } from "../enum";
import { Products } from "./products";

// Any name a product can be found by: barcode, manufacturer id (BOM/PID/Part
// Number), vendor sku, nickname, etc. One product has unlimited alias rows, all
// searchable — so a new vendor's scheme is a new `termType`/`label`, not a new
// column.
export const ProductAliases = mysqlTable(
  "ProductAliases",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    productUuid: char("product_uuid", { length: 36 })
      .notNull()
      .references(() => Products.uuid, { onDelete: "cascade" }),

    // The exact string a user might type to reach the product.
    searchTerm: varchar("search_term", { length: 255 }).notNull(),
    termType: mysqlEnum("term_type", aliasTermTypes).notNull(),
    // Per-vendor display name for a manufacturer id (e.g. "BOM", "PID").
    label: varchar("label", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_product_aliases_product_uuid").on(table.productUuid),
    index("idx_product_aliases_search_term").on(table.searchTerm),
  ],
);

export type SelectProductAliases = InferSelectModel<typeof ProductAliases>;
export type InsertProductAliases = InferInsertModel<typeof ProductAliases>;
