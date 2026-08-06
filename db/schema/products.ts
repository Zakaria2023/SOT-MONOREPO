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
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  assignmentAudiences,
  boqItemRoles,
  lifecycleStatuses,
  productStatuses,
} from "../enum";
import { ProductValues } from "../types";
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

    // Which member of a variant family this row is, as Variants.uuid values.
    //
    // A SET, because the axes stack: `FireProtect 2 RB (CO) UL Jeweller` differs
    // from its siblings on battery, sensor, certification and radio at once, and
    // a single string holding all four cannot be searched, grouped or matched by
    // an importer.
    //
    // Half the product's IDENTITY rather than a label. Brands reuse one URL slug
    // across a whole variant family — 86 of Ajax's 290 products share a slug with
    // a sibling — so keyed on the slug those 86 overwrote each other in silence:
    // the count came back 204 and every collision looked like a page that had not
    // been harvested. Variants also differ on rule-bearing attributes (an RB and
    // an SB carry different certifications), so one row standing for both answers
    // a compliance rule with whichever happened to be entered.
    variantUuids: json("variant_uuids").$type<string[]>(),

    // The variant set flattened into one comparable string — sorted variant
    // slugs, joined. Maintained by the service on every write.
    //
    // It exists because identity has to be enforceable by the DATABASE and a
    // unique index cannot span a JSON array. With it, brand + model + signature
    // is a real constraint that holds against any writer, including one that
    // forgot to ask.
    //
    // SORTED, so the same set always produces the same signature — otherwise the
    // order an author happened to tick two boxes in would decide whether a
    // duplicate was caught. Built from slugs rather than uuids so it stays
    // readable in a query, and rebuilt from the set rather than typed so the two
    // can never disagree.
    variantKey: varchar("variant_key", { length: 255 }),

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

    // WHO MAY SEE THIS PRODUCT on a shopper surface. Default `everyone`.
    //
    // A whole product line can be trade-only: Ajax's Superior range is sold to
    // installers and not to the public. That is a fact about the PRODUCTS, and
    // the audience switches already in the model are not — they sit on an
    // attribute and on an assignment, so setting one to `partner` hides the
    // attribute everywhere rather than hiding the Superior products anywhere.
    // Nothing else could express this.
    //
    // Visibility only. It never reaches the rules engine, exactly as the
    // attribute-level audience never does: if a partner-only product validated
    // differently for two people, the same design would pass one and fail the
    // other and neither could be shown why. A product a user cannot browse is
    // still checked normally when it is in front of the engine.
    //
    // Staff surfaces ignore it. The admin panel is where the catalogue is
    // authored, and a product an author cannot see is one they cannot notice is
    // wrong.
    audience: mysqlEnum("audience", assignmentAudiences)
      .default("everyone")
      .notNull(),

    // The product's attribute values, keyed by Specifications.uuid and stored
    // TYPED — a number as a number, a multi-select as an array, a boolean as
    // true/false.
    //
    // Keyed by uuid, not by a label-derived slug: a slug changes when the label
    // changes, and every value stored under the old slug would silently orphan
    // while rules that read it quietly stopped firing. An orphaned value does
    // not look like an error — it looks like a passing check.
    //
    // Typed, not stringly: `Number("12 W")` is NaN, and a comma-joined
    // multi-select corrupts the moment an option label contains a comma. The
    // engine sums these directly, so the parse has to have happened already.
    //
    // WHICH attributes a product carries is not stored here — it is resolved
    // from the category's assignment chain, so adding an attribute to a category
    // immediately applies to every product in it.
    specValues: json("spec_values").$type<ProductValues>(),

    // `technical_attributes` used to sit here — the pre-migration string-keyed
    // value map, kept as a safety net after specValues was backfilled from it.
    // Removed from the schema now that specValues has been in production long
    // enough: nothing read it, nothing wrote it, and leaving it declared meant
    // every product query dragged a JSON blob across the wire to render cards
    // that never opened it.
    //
    // The column is still in the database. Drop it when convenient:
    //
    //   ALTER TABLE Products DROP COLUMN technical_attributes;
    //
    // Until then drizzle-kit will offer to drop it for you — that one is safe to
    // accept, unlike its enum rewrites.

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
    // THE IDENTITY OF A PRODUCT, and the backstop under every import.
    //
    // Brand + model + variant set, not the slug and not the name. A slug is
    // derived from a name and brands reuse both across a variant family, so
    // keying on either lets two real products collapse into one with nothing
    // raised.
    //
    // The set arrives here as `variantKey` because a unique index cannot span a
    // JSON array. That is the whole reason the signature column exists: without
    // it this guarantee would live only in the service, and the one writer that
    // forgot to ask is exactly the one that does the damage.
    //
    // MySQL treats NULLs in a unique index as distinct, which is deliberate here
    // rather than tolerated: products entered before this existed carry no model,
    // and a constraint that rejected them would make this change a migration
    // nobody can run. It binds exactly where identity is actually claimed.
    unique("uq_products_brand_model_variant").on(
      table.brandUuid,
      table.model,
      table.variantKey,
    ),
  ],
);

export type SelectProducts = InferSelectModel<typeof Products>;
export type InsertProducts = InferInsertModel<typeof Products>;
