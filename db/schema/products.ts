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
    sku: varchar("sku", { length: 100 }).unique(),
    model: varchar("model", { length: 255 }),

    partNumber: varchar("part_number", { length: 255 }), // PN
    modelNumber: varchar("model_number", { length: 255 }), // MN
    bom: text("bom"), // BOM — Bill of Materials

    description: text("description"), // long detail description
    role: varchar("role", { length: 500 }), // "role in your network"

    // Media
    image: varchar("image", { length: 255 }),
    images: json("images").$type<string[]>(),

    // Merchandising
    isFeatured: boolean("is_featured").default(false),

    // Pricing
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
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
