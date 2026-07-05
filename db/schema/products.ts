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
import { productStatuses } from "../../apps/admin/src/lib/enum";

export type ProductHighlight = {
  k: string;
  v: string;
};

export type ProductSpecGroup = {
  title: string;
  rows: { k: string; v: string }[];
};

export const Products = mysqlTable(
  "Products",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    // Relations
    categoryUuid: char("category_uuid", { length: 36 }).notNull(),
    brandUuid: char("brand_uuid", { length: 36 }).notNull(),

    // Identity
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    sku: varchar("sku", { length: 100 }).unique(), // e.g. model / part number
    model: varchar("model", { length: 255 }), // "Meridian Gateway Pro X"

    blurb: varchar("blurb", { length: 500 }), // short line on the card
    description: text("description"), // long detail description
    role: varchar("role", { length: 500 }), // "role in your network"

    // Media
    image: varchar("image", { length: 255 }),
    iconKey: varchar("icon_key", { length: 100 }), // lucide/glyph key used in UI

    // Merchandising
    ribbon: varchar("ribbon", { length: 100 }), // "Recommended", "New" badge
    isFeatured: boolean("is_featured").default(false),

    // Pricing
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).default("SAR"),

    // Inventory
    stock: int("stock").default(0),

    highlights: json("highlights").$type<ProductHighlight[]>(), // [{ k: "Throughput", v: "10 Gbps" }, ...]
    specGroups: json("spec_groups").$type<ProductSpecGroup[]>(), // [{ title, rows: [{ k, v }] }, ...]

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
