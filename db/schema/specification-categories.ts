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
import { ShowIfCondition } from "../types";
import { Categories } from "./categories";
import { Specifications } from "./specifications";

// An ASSIGNMENT: a category borrowing an attribute from the library. The two
// registries — the attribute library (Specifications) and the category tree
// (Categories) — never merge; they join here, and only the switches on this
// row vary per category. The definition (label, value type, master option
// list) always stays in the library, identical everywhere it's used.
//
// A specification assigned to a category also applies to that category's
// descendants; that inheritance is resolved at query time, not stored here. A
// descendant may carry its own row for the same specification to override the
// switches — nearest ancestor wins.
export const SpecificationCategories = mysqlTable(
  "SpecificationCategories",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    specificationUuid: char("specification_uuid", { length: 36 }).notNull(),
    categoryUuid: char("category_uuid", { length: 36 }).notNull(),

    // Switch 1 — does the shopper see it and click it? On = the attribute is
    // offered as a facet on the category page. Off = invisible to the shopper,
    // though it may still be alive underneath (switch 2).
    isFilter: boolean("is_filter").default(false).notNull(),

    // Switch 2 — does the compatibility engine read it? On = the value feeds
    // rules. The combination isFilter=false + isRule=true is the important one:
    // a preamplifier's 1G port is never shopped by, but the engine must know it
    // to warn that the network needs a 1G port.
    isRule: boolean("is_rule").default(true).notNull(),

    // Switch 3 — how far the FILTER reaches (branch-wide vs leaf-only). Only
    // read when isFilter is on; rule participation always inherits down.
    scope: mysqlEnum("scope", assignmentScopes).default("branch").notNull(),

    // Switch 4 — conditional reveal. Null = always shown. When set and the
    // condition fails, the attribute is hidden AND its stored value cleared.
    showIf: json("show_if").$type<ShowIfCondition | null>(),

    // Who the attribute is surfaced to. Never gates rule participation.
    audience: mysqlEnum("audience", assignmentAudiences)
      .default("all")
      .notNull(),

    // The slice of the library's master option list this category OFFERS, as
    // option values. Null/empty = the whole master list. This narrows what can
    // be picked here; it never edits, renames or adds options, so the attribute
    // stays comparable across every category that borrows it. On an ordered
    // attribute the slice reads as a ceiling (see Specifications.ordered).
    enabledValues: json("enabled_values").$type<string[] | null>(),

    // Display order of the attribute within this category, independent of the
    // library's own ordering.
    order: int("order").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
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
