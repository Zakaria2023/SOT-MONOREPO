import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  foreignKey,
  index,
  int,
  mysqlTable,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { Products } from "./products";

// WHAT IS IN THE BOX — and, just as importantly, what is not.
//
// §2.9 asks for `sys.complete_set` as `[{item, qty, included}]`, and `item` is
// another PRODUCT. That is why it could not be a specification attribute: a
// spec value is a number, a pick from a controlled list, or a row of those, and
// none of them is a foreign key. Put a product uuid inside a `specValues` JSON
// map and nothing can join it, nothing cascades when the product is deleted, and
// the reference rots into a string that used to mean something.
//
// So it is a table, for the same reason ProductCompatibility is one: it is a
// fact ABOUT TWO PRODUCTS, and those belong between rows rather than inside one.
//
// `included` is the whole point of the field, not a detail of it. §2.9 also asks
// for `sys.accessory_completeness` — "requires separately-sold parts to function
// as described" — and that boolean is exactly this column read across a product's
// rows. Recording both would be one fact in two places, so the boolean is
// derived and never stored: DoubleButton needs its Holder, GlandBox needs its red
// glands, the EN54 CIE needs an Internal Battery, and each of those is one row
// here with `included` off.
//
// Two shapes share the table, deliberately:
//
//   a BUNDLE — a StarterKit is a panel plus detectors sold as one SKU, so its
//   rows are `included` and the customer already has them;
//   a PREREQUISITE — a device that does not work until something sold separately
//   is bought too, so its rows are NOT `included` and the basket is short.
//
// One table because the question a buyer needs answered is the same either way:
// what does this product need in order to work, and have I got it. Splitting them
// would mean two tables, two readers, and one of them eventually forgotten.
export const ProductComposition = mysqlTable(
  "ProductComposition",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    // The product being described.
    parentUuid: char("parent_uuid", { length: 36 }).notNull(),
    // The product it contains or requires.
    childUuid: char("child_uuid", { length: 36 }).notNull(),

    // How many. A StarterKit with three detectors is one row with quantity 3,
    // not three rows — three rows would be three separate facts about the same
    // pair, and the unique index below refuses them for that reason.
    quantity: int("quantity").default(1).notNull(),

    // IN THE BOX, or bought separately.
    //
    // Default TRUE, because the ordinary row is a bundle listing its contents,
    // and the safe default is the one that claims nothing is missing. A
    // prerequisite is an author saying so explicitly — the opposite default would
    // turn every unfinished bundle into a basket full of warnings.
    included: boolean("included").default(true).notNull(),

    // Why it is needed, in the buyer's words — "the Holder is what fixes it to a
    // wall". Only worth writing on a prerequisite; a bundle's contents explain
    // themselves.
    note: varchar("note", { length: 500 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  // FK constraints are named explicitly — the auto-generated names exceed
  // MySQL's 64-char identifier limit.
  (table) => [
    index("idx_product_composition_parent").on(table.parentUuid),
    index("idx_product_composition_child").on(table.childUuid),
    // One row per pair. A second row for the same pair is two answers to "how
    // many of these does it need", and a reader totalling them would silently
    // double a bundle's contents.
    unique("uq_product_composition_pair").on(table.parentUuid, table.childUuid),
    // CASCADE both ways, as with a compatibility pair and for the same reason: a
    // row here is a claim about two specific products, and with either of them
    // gone it says nothing. A rule is different — it references attributes, it
    // outlives any product, and deleting a product must never delete one.
    foreignKey({
      name: "fk_product_composition_parent",
      columns: [table.parentUuid],
      foreignColumns: [Products.uuid],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_product_composition_child",
      columns: [table.childUuid],
      foreignColumns: [Products.uuid],
    }).onDelete("cascade"),
  ],
);

export type SelectProductComposition = InferSelectModel<
  typeof ProductComposition
>;
export type InsertProductComposition = InferInsertModel<
  typeof ProductComposition
>;
