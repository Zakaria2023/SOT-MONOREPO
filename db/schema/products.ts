import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { productStatuses } from "../enum";
import { Highlight, SpecGroup } from "../types";
import { Brands } from "./brands";
import { Categories } from "./categories";

export const Products = mysqlTable(
  "Products",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    // Relations
    categoryUuid: char("category_uuid", { length: 36 })
      .notNull()
      .references(() => Categories.uuid, { onDelete: "restrict" }),
    brandUuid: char("brand_uuid", { length: 36 })
      .notNull()
      .references(() => Brands.uuid, { onDelete: "restrict" }),

    // Identity
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    // Auto-generated smart SKU — assembled last from brand/category/series codes.
    // Format: [BRAND-LINE][CATEGORY][SERIES]-[KEYSPECS]-[SEQ]. KEYSPECS is
    // reserved until the structured spec template exists.
    sku: varchar("sku", { length: 100 }).unique(),
    model: varchar("model", { length: 255 }),

    // Vendor series/line — feeds the [SERIES] SKU segment and vendor mapping.
    productFamily: varchar("product_family", { length: 255 }),
    seriesCode: varchar("series_code", { length: 4 }),

    // Identifiers (part number, model number, BOM, barcode, nicknames…) are not
    // fixed columns — they live as searchable rows in ProductAliases.

    // Vendor taxonomy tag (Vendor › Line › Sub-line) for mapping & rebate
    // tracking. Phase 1 is a hand-entered tag; a full taxonomy table comes later.
    vendorNode: varchar("vendor_node", { length: 255 }),

    description: text("description"), // long detail description
    role: varchar("role", { length: 500 }), // "role in your network"

    // Media
    image: varchar("image", { length: 255 }),
    images: json("images").$type<string[]>(),

    // Merchandising
    isFeatured: boolean("is_featured").default(false),

    // Pricing — optional; a partner can set the price when they quote the product.
    price: decimal("price", { precision: 12, scale: 2 }),
    currency: char("currency", { length: 3 }).default("SAR"),

    // Inventory
    stock: int("stock").default(0),

    highlights: json("highlights").$type<Highlight[]>(),
    specGroups: json("spec_groups").$type<SpecGroup[]>(),

    // State & ordering
    status: mysqlEnum("status", productStatuses).default("draft"),
    order: int("order").default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_products_category_uuid").on(table.categoryUuid),
    index("idx_products_brand_uuid").on(table.brandUuid),
    index("idx_products_status").on(table.status),
  ],
);

export type SelectProducts = InferSelectModel<typeof Products>;
export type InsertProducts = InferInsertModel<typeof Products>;
