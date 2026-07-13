import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  foreignKey,
  index,
  int,
  mysqlTable,
  timestamp,
  unique,
} from "drizzle-orm/mysql-core";
import { Categories } from "./categories";
import { Specifications } from "./specifications";

// Many-to-many link between a specification and the categories it applies to.
// A specification on a category also applies to that category's descendants;
// that inheritance is resolved at query time, not stored here.
export const SpecificationCategories = mysqlTable(
  "SpecificationCategories",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    specificationUuid: char("specification_uuid", { length: 36 }).notNull(),
    categoryUuid: char("category_uuid", { length: 36 }).notNull(),

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
