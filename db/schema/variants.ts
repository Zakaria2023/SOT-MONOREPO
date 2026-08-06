import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// A VARIANT — one axis on which two otherwise identical products differ.
//
// "RB" and "SB" (which battery), "(2G)" and "(4G)" (which modem), "White" and
// "Yellow", "Fibra" and "Jeweller", "without casing", "UL". A product carries as
// many of these at once as it needs: `FireProtect 2 RB (CO) UL Jeweller` is four
// of them stacked, which is why a product's variant is a SET and not a string.
//
// A TABLE rather than free text on the product, for the reason every controlled
// list in this system exists: the same axis recurs across hundreds of products,
// and typed fresh each time it forks. "4G", "(4G)", "4 G" and "LTE" would become
// four axes that no query can group and no importer can match, and the fork is
// invisible — every product looks entered.
//
// Deliberately NOT a specification attribute. A spec value describes what a
// product IS; a variant is part of WHICH product it is, and it is read by the
// identity check rather than by any rule. Filing it in the library would put it
// in front of every rule author for a fact no rule can use.
export const Variants = mysqlTable("Variants", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  // What an author picks it by, and what appears in a product's name.
  name: varchar("name", { length: 120 }).notNull(),

  // The stable, comparable form — lowercase, punctuation-free. Two things read
  // it: the near-duplicate guard, so "(4G)" cannot be added beside "4G"; and the
  // identity signature on a product, so the same set of variants always produces
  // the same signature no matter how the names are later edited.
  //
  // Unique, which is what makes the guard a guarantee rather than a convention.
  slug: varchar("slug", { length: 120 }).notNull().unique(),

  order: int("order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectVariants = InferSelectModel<typeof Variants>;
export type InsertVariants = InferInsertModel<typeof Variants>;
