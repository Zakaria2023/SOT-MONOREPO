import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { compatibilityVerdicts } from "../enum";
import { Products } from "./products";

// A BRAND-AUTHORED PAIR — this exact product works (or does not) with that one.
//
// THE EXCEPTION LIST, deliberately. Compatibility is supposed to be DERIVED:
// a rule reads the attributes both sides carry, so a new SKU joins every
// existing rule the moment its values are filled in and a second brand with the
// same radio just works. Naming products in a rule throws that away — the
// catalogue stops scaling and every new product needs someone to remember it.
//
// So this table exists for the pairs that genuinely cannot be derived, and it is
// meant to stay small. Three shapes turned up in the real Ajax matrix:
//
//   - an accessory tied to one specific host (six range-extender batteries, each
//     fitting one hub and nothing else) — there is no attribute that says this,
//     only a mechanical fact about a moulding;
//   - a physical fit nothing measures (the ExternalAntenna's six hubs, which the
//     datasheet gets wrong and the matrix gets right);
//   - a bundle (the StarterKits), which is a SKU containing a panel rather than
//     a device that pairs with one.
//
// EVERYTHING ELSE — all 23 Fibra devices mapping to exactly the four
// Fibra-capable hubs, every Jeweller device to every Jeweller hub — is what
// `net.link_technology` and the product-line compatibility group already say,
// and a rule that reads those reproduces it without a single row here.
//
// The `source` column is what keeps that honest. Rows imported from a brand
// matrix are a claim we can re-derive and re-check; rows typed by hand are a
// claim somebody made once. Mixed together with no way to tell them apart, this
// table becomes the place compatibility actually lives, which is the outcome the
// whole attribute model exists to avoid.
export const ProductCompatibility = mysqlTable(
  "ProductCompatibility",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    // DIRECTIONAL: `a` is the device, `b` is the host it attaches to. A battery
    // fits a hub; a hub does not fit a battery. Storing one row per direction
    // rather than a symmetric pair is what lets the reader answer "what may I
    // attach to this" without also answering the nonsense question.
    productUuidA: char("product_uuid_a", { length: 36 }).notNull(),
    productUuidB: char("product_uuid_b", { length: 36 }).notNull(),

    // `compatible` records a pair the derived rules would REFUSE and the brand
    // allows. `incompatible` records the reverse — a pair the rules would pass
    // and the brand says does not work.
    //
    // Both directions matter and they are not symmetric in consequence: a missing
    // `compatible` row blocks a sale that should have gone through, while a
    // missing `incompatible` row sells something that does not work.
    verdict: mysqlEnum("verdict", compatibilityVerdicts).notNull(),

    // Why, in the buyer's words, for when this is what decided their basket.
    // A finding that says "these do not work together" and cannot say why is one
    // the buyer has no way to act on and support has no way to defend.
    note: varchar("note", { length: 500 }),

    // WHERE THE CLAIM CAME FROM — "Ajax device compatibility PDF 2026-08-06", or
    // a person's name. Not decoration: a brand matrix is dated and regenerable,
    // so when it disagrees with a datasheet the matrix wins, and when a newer
    // export arrives the rows from the older one can be replaced wholesale.
    // Hand-authored rows cannot be, and this is the only thing that says which is
    // which.
    source: varchar("source", { length: 255 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  // FK constraints are named explicitly — the auto-generated names exceed
  // MySQL's 64-char identifier limit.
  (table) => [
    index("idx_product_compat_a").on(table.productUuidA),
    index("idx_product_compat_b").on(table.productUuidB),
    // One verdict per ordered pair. Two rows saying opposite things about the
    // same pair is a question with no answer, and whichever the reader happened
    // to load first would decide a sale.
    unique("uq_product_compat_pair").on(table.productUuidA, table.productUuidB),
    // CASCADE, unlike the deletion guard that protects a rule. A relationship
    // references attributes and outlives any one product, so deleting a product
    // must never delete a safety rule. A row here is a claim ABOUT two specific
    // products — with one of them gone it says nothing, and keeping it would
    // leave a pair pointing at a uuid no query resolves.
    foreignKey({
      name: "fk_product_compat_a",
      columns: [table.productUuidA],
      foreignColumns: [Products.uuid],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_product_compat_b",
      columns: [table.productUuidB],
      foreignColumns: [Products.uuid],
    }).onDelete("cascade"),
  ],
);

export type SelectProductCompatibility = InferSelectModel<
  typeof ProductCompatibility
>;
export type InsertProductCompatibility = InferInsertModel<
  typeof ProductCompatibility
>;
