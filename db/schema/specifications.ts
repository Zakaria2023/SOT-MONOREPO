import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { assignmentAudiences, specValueTypes } from "../enum";
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
  // The richer library-builder type (number/single_select/multi_select/
  // boolean/text). valueType + allowMultiple stay the engine-facing truth;
  // this drives the builder UI. Nullable — derived from valueType on old rows.
  inputType: varchar("input_type", { length: 20 }),
  unit: varchar("unit", { length: 32 }),

  // "select" modifier: products may tick several options instead of one. The
  // chosen values are stored comma-joined in the product's attribute map.
  allowMultiple: boolean("allow_multiple").default(false).notNull(),
  // "number" modifier: products enter a from–to range instead of a single
  // value. Stored as "from - to"; the rule engine budgets a range consumer at
  // its max and a range provider at its min.
  allowRange: boolean("allow_range").default(false).notNull(),

  // Who this attribute is for. Set once, where the attribute is born: an
  // installer certification is a partner concern wherever it is used, not
  // something each category should have to remember. A category may narrow
  // this further on its assignment, but never widen it — so marking an
  // attribute partner-only here cannot be undone by a category exposing it
  // publicly by mistake.
  audience: mysqlEnum("audience", assignmentAudiences)
    .default("everyone")
    .notNull(),

  // Whether `options` is an ORDERED scale (802.3af < at < bt; 1G < 10G;
  // Cat5e < Cat6 < Cat6a) rather than an unordered set (Black | White). Two
  // behaviours read it:
  //   - rules: the lte/gte comparators compare an option's INDEX in this list,
  //     so "consumer's PoE type must be at most what the switch supplies" works
  //     on a select spec.
  //   - assignments: an enabled slice reads as a CEILING (everything up to the
  //     highest enabled option) instead of plain set membership.
  // Definition-level, never per-category — the ordering is a property of the
  // attribute itself.
  ordered: boolean("ordered").default(false).notNull(),

  // The master option list. Categories narrow which of these they OFFER (see
  // SpecificationCategories.enabledValues) but never edit this list — a
  // per-category edit would fork the attribute and break every rule that
  // compares across categories.
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
