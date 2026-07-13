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
import { businessLines, productStatuses } from "../enum";
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

    shortDescription: varchar("short_description", { length: 500 }), // vendor-neutral one-liner
    description: text("description"), // long detail description
    role: varchar("role", { length: 500 }), // "role in your network"

    // Datasheet PDF (document id) — served free, no login, from the storefront.
    datasheet: varchar("datasheet", { length: 64 }),

    // Media
    image: varchar("image", { length: 255 }),
    images: json("images").$type<string[]>(),

    // Trust & warranty. warrantyRegion backs the "official / Saudi-warranty"
    // anti-gray-market badge; warrantyExtendable gates the "extend warranty" CTA.
    warrantyPeriod: varchar("warranty_period", { length: 50 }), // e.g. "24 months"
    warrantyRegion: varchar("warranty_region", { length: 100 }),
    warrantyExtendable: boolean("warranty_extendable").default(false).notNull(),
    countryOfOrigin: varchar("country_of_origin", { length: 100 }),

    // Merchandising
    isFeatured: boolean("is_featured").default(false),

    // Anchor flag: the "brain" of a system (hub, NVR, IP PBX, core switch). A
    // cart containing an anchor enters the solution-confirmation gate.
    needsSolutionReview: boolean("needs_solution_review")
      .default(false)
      .notNull(),

    // Price book. `price` is the public MSRP — the only price shown publicly.
    // Cost + system-integrator define the internal margin pool. Sub-distributor
    // and end-user tiers are dormant structure (not used in Phase 1).
    price: decimal("price", { precision: 12, scale: 2 }), // public MSRP
    priceCost: decimal("price_cost", { precision: 12, scale: 2 }),
    priceSystemIntegrator: decimal("price_system_integrator", {
      precision: 12,
      scale: 2,
    }),
    priceSubDistributor: decimal("price_sub_distributor", {
      precision: 12,
      scale: 2,
    }),
    priceEndUser: decimal("price_end_user", { precision: 12, scale: 2 }),
    currency: char("currency", { length: 3 }).default("SAR"),
    businessLine: mysqlEnum("business_line", businessLines).default("consumer"),

    // Inventory. `stock` is an internal count (never shown to customers).
    // `isAvailable` is the manual Available/Unavailable storefront toggle — the
    // Phase-1 signal until the real-time Odoo stock link arrives.
    stock: int("stock").default(0),
    isAvailable: boolean("is_available").default(true).notNull(),

    highlights: json("highlights").$type<Highlight[]>(),
    specGroups: json("spec_groups").$type<SpecGroup[]>(),
    // Dropdown-only values filled from the category's spec template, keyed by
    // SpecField.key. Machine-reasonable specs for filtering and the AI builder.
    technicalAttributes: json("technical_attributes").$type<
      Record<string, string>
    >(),

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
