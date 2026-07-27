import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  unique,
} from "drizzle-orm/mysql-core";
import { assignmentAudiences, assignmentScopes } from "../enum";
import { Predicate } from "../types";
import { Categories } from "./categories";
import { Specifications } from "./specifications";

// AN ASSIGNMENT — a category borrowing an attribute from the library.
//
// The two registries never merge: the library holds each definition once, the
// tree holds navigation, and they join HERE. Only the switches on this row vary
// per category; the definition (label, type, master option list) stays
// identical everywhere it is used.
//
// An assignment may name another ATTRIBUTE (that is what `showIf` is) but never
// another PRODUCT — the moment it could say "must fit the switch's budget" it
// would have become a relationship.
//
// Inheritance is resolved at query time, not stored: an assignment applies to
// the category and every descendant, and a descendant may carry its own row for
// the same attribute to override the switches. Nearest ancestor wins.
export const SpecificationCategories = mysqlTable(
  "SpecificationCategories",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    specificationUuid: char("specification_uuid", { length: 36 }).notNull(),
    categoryUuid: char("category_uuid", { length: 36 }).notNull(),

    // Switch 1 — does the shopper see it and click it?
    isFilter: boolean("is_filter").default(false).notNull(),

    // Switch 2 — does the compatibility engine read it? The combination
    // isFilter=false + isRule=true is the important one: a "living" attribute.
    // An access point's uplink port speed is never shopped by, but the engine
    // must know it to size the switch.
    isRule: boolean("is_rule").default(true).notNull(),

    // Switch 3 — how far the FILTER reaches. Only read when isFilter is on;
    // rule participation ALWAYS inherits down the whole subtree, because a
    // leaf-scoped facet silently switching off a safety rule on descendants is
    // never what anyone means.
    scope: mysqlEnum("scope", assignmentScopes).default("branch").notNull(),

    // Switch 4 — conditional reveal, in the one shared predicate language. Null
    // = always shown. When it stops matching, the attribute is hidden AND its
    // stored value is cleared: a leftover PoE budget on a product whose PoE is
    // now "No" would let the engine size a switch off a number that no longer
    // applies.
    //
    // The trigger may be any attribute that RESOLVES for this category —
    // inherited from an ancestor or assigned here. Requiring it to be local
    // would force every branch-level attribute to be re-assigned on every leaf
    // just to be usable as a trigger, which defeats inheritance.
    showIf: json("show_if").$type<Predicate | null>(),

    // Switch 5 — who the attribute is surfaced to. NEVER gates rule
    // participation: if a partner-only attribute stopped feeding the engine for
    // an ordinary user, the same cart would validate differently for two
    // people. The library's audience wins unless it left the choice open.
    audience: mysqlEnum("audience", assignmentAudiences)
      .default("everyone")
      .notNull(),

    // Switch 6 — the slice of the master option list this category OFFERS, as
    // option values. Null/empty = the whole list.
    //
    // Read LITERALLY: exactly these values, gaps included. A "ceiling" reading
    // (everything up to the highest enabled option) silently re-includes values
    // the author deliberately excluded. Authoring a ceiling stays one click in
    // the admin — it just fills the values in rather than reinterpreting them
    // later.
    enabledValues: json("enabled_values").$type<string[] | null>(),

    // Switch 7 — suppression. A descendant may REMOVE an inherited attribute
    // entirely. Turning both isFilter and isRule off is not the same thing: the
    // attribute still resolves, still appears in exports, still occupies a row
    // in the product form logic. Faking absence with two false flags is the kind
    // of thing nobody remembers six months later.
    suppressed: boolean("suppressed").default(false).notNull(),

    // Display order within this category, independent of the library's own.
    order: int("order").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  // FK constraints are named explicitly — the auto-generated names exceed
  // MySQL's 64-char identifier limit.
  (table) => [
    index("idx_spec_categories_spec_uuid").on(table.specificationUuid),
    index("idx_spec_categories_category_uuid").on(table.categoryUuid),
    unique("uq_spec_categories_spec_category").on(
      table.specificationUuid,
      table.categoryUuid,
    ),
    foreignKey({
      name: "fk_spec_categories_spec",
      columns: [table.specificationUuid],
      foreignColumns: [Specifications.uuid],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_spec_categories_category",
      columns: [table.categoryUuid],
      foreignColumns: [Categories.uuid],
    }).onDelete("cascade"),
  ],
);

export type SelectSpecificationCategories = InferSelectModel<
  typeof SpecificationCategories
>;
export type InsertSpecificationCategories = InferInsertModel<
  typeof SpecificationCategories
>;
