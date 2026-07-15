import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { specValueTypes } from "../enum";
import { SpecOption, SpecRule } from "../types";
import { SpecificationGroups } from "./specification-groups";

// A single specification field (e.g. "PoE") with its dropdown options. Each
// option can reveal nested child fields (the conditional tree) stored as JSON.
// Specifications are assigned to categories via SpecificationCategories and
// apply to those categories and all of their descendants.
export const Specifications = mysqlTable("Specifications", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  // Master-library group (Power, Connectivity, ...) — organizational only.
  groupUuid: char("group_uuid", { length: 36 }).references(
    () => SpecificationGroups.uuid,
    { onDelete: "set null" },
  ),

  label: varchar("label", { length: 255 }).notNull(),
  // Stable key derived from the label — products store chosen values under it.
  key: varchar("key", { length: 255 }).notNull(),

  // "select" = dropdown options below; "number" = a typed numeric value in
  // `unit` — the values the compatibility rule engine aggregates.
  valueType: mysqlEnum("value_type", specValueTypes)
    .default("select")
    .notNull(),
  unit: varchar("unit", { length: 32 }),

  options: json("options").$type<SpecOption[]>(),

  // Rules that force this specification's value when other specs' chosen
  // values match — evaluated live in the admin product form.
  rules: json("rules").$type<SpecRule[]>(),

  order: int("order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectSpecifications = InferSelectModel<typeof Specifications>;
export type InsertSpecifications = InferInsertModel<typeof Specifications>;
