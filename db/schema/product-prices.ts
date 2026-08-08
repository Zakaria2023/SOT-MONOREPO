import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  decimal,
  foreignKey,
  index,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { Products } from "./products";

// WHAT A PRODUCT COST, AND WHEN.
//
// `Products.price` holds one number with no date on it, which cannot answer the
// question a quote depends on: what was this priced at on the day we quoted it?
// Re-opening a three-week-old offer re-read today's price and showed the
// customer a different total than the one they were sent.
//
// So a price is a row with a window. The row in force at an instant is the one
// whose window contains it, and `Products.price` stays as the fallback for a
// product nobody has dated yet — stated precedence rather than two sources
// quietly disagreeing.
//
// Overlapping windows are possible and are resolved by taking the latest
// `effective_from`, so correcting a price is "open a new window today" rather
// than "find and close the old one first". A pricing change made in a hurry
// should not require getting two rows right.
export const ProductPrices = mysqlTable(
  "ProductPrices",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    productUuid: char("product_uuid", { length: 36 }).notNull(),

    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).default("SAR").notNull(),

    effectiveFrom: timestamp("effective_from").notNull(),
    // Null means "still in force". An open window is the normal state; closing
    // one is only needed to say a product had no price for a stretch.
    effectiveTo: timestamp("effective_to"),

    // Why the price moved. A price list nobody can explain is one nobody dares
    // correct.
    note: varchar("note", { length: 255 }),
    actorName: varchar("actor_name", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.productUuid],
      foreignColumns: [Products.uuid],
      name: "fk_product_prices_product",
    }).onDelete("cascade"),
    index("idx_product_prices_window").on(table.productUuid, table.effectiveFrom),
  ],
);

export type SelectProductPrices = InferSelectModel<typeof ProductPrices>;
export type InsertProductPrices = InferInsertModel<typeof ProductPrices>;
