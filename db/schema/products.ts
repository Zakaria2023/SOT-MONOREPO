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
import { boqItemRoles, lifecycleStatuses, productStatuses } from "../enum";
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

    // Value for the selected brand's ID label (Brands.idLabel — e.g. the brand's
    // own BOM / PID / Part Number). The label comes from the brand; this is the
    // per-product value entered against it.
    brandIdValue: varchar("brand_id_value", { length: 255 }),

    // Vendor series/line — feeds the [SERIES] SKU segment and vendor mapping.
    seriesCode: varchar("series_code", { length: 4 }),

    shortDescription: varchar("short_description", { length: 500 }), // vendor-neutral one-liner
    description: text("description"), // long detail description

    // Datasheet PDF (document id) — served free, no login, from the storefront.
    datasheet: varchar("datasheet", { length: 64 }),

    // Media
    image: varchar("image", { length: 255 }),
    images: json("images").$type<string[]>(),

    // Trust & warranty. warrantyRegion backs the "official / Saudi-warranty"
    // anti-gray-market badge; warrantyExtendable gates the "extend warranty" CTA.
    warrantyPeriod: varchar("warranty_period", { length: 50 }), // e.g. "24 months"
    warrantyRegion: varchar("warranty_region", { length: 100 }),
    countryOfOrigin: varchar("country_of_origin", { length: 100 }),

    // Structured place in a system — anchor / peripheral / accessory.
    // Snapshotted onto each BOQ line so completeness/requires-companion
    // validation can key off it.
    systemRole: mysqlEnum("system_role", boqItemRoles),

    // Price book. `price` is the public MSRP — the only price shown publicly.
    price: decimal("price", { precision: 12, scale: 2 }), // public MSRP
    currency: char("currency", { length: 3 }).default("SAR"),

    // `isAvailable` is the manual Available/Unavailable storefront toggle — the
    // Phase-1 signal until the real-time Odoo stock link arrives.
    isAvailable: boolean("is_available").default(true).notNull(),

    // The library attributes chosen for THIS product (ordered spec keys),
    // picked from the specification library on the product form. Values live in
    // technicalAttributes keyed by the same key. Empty/absent falls back to the
    // keys present in technicalAttributes (older products).
    specKeys: json("spec_keys").$type<string[]>(),

    // Values for the product's chosen attributes, keyed by SpecField.key.
    // Machine-reasonable specs for filtering, rules, and the AI builder.
    technicalAttributes: json("technical_attributes").$type<
      Record<string, string>
    >(),

    // State & ordering
    status: mysqlEnum("status", productStatuses).default("in_stock"),
    order: int("order").default(0),

    // RESERVED / dormant — for the EOL and cross-vendor-equivalence features
    // later. No UI yet; the hooks exist so nothing needs retrofitting.
    lifecycleStatus: mysqlEnum("lifecycle_status", lifecycleStatuses),
    replacedBy: char("replaced_by", { length: 36 }), // successor product uuid
    equivalents: json("equivalents").$type<string[]>(), // cross-vendor uuids

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
