import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// A group in the master spec library (Power, Connectivity, Physical, ...).
// Purely organizational: keeps the library manageable as it grows. A
// specification may belong to at most one group.
export const SpecificationGroups = mysqlTable("SpecificationGroups", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  name: varchar("name", { length: 255 }).notNull(),
  // Navigation domain (see specificationDomains in db/enum.ts). Nullable so a
  // group can be unfiled; stored as a plain key, validated in the app.
  domain: varchar("domain", { length: 50 }),

  // The first segment of every external name filed under this group — `pwr` for
  // Power & Battery, `phys` for Physical & Mounting.
  //
  // It exists so an attribute's external name can be DERIVED rather than typed.
  // That name is the one thing an import mapping, an export and a spreadsheet
  // all key on, and asking each author to invent it produced exactly what you
  // would expect: a field most people left blank, and a scattering of `poe`,
  // `poe-budget` and `pwr.poe_budget_w` for facts of the same kind.
  //
  // A prefix is a decision made ONCE per group, by whoever set the group up,
  // rather than once per attribute by whoever happened to be adding one. Nine
  // decisions instead of a hundred and fifty.
  //
  // Nullable, and the derivation falls back to the label alone when it is unset
  // — a group nobody has prefixed still produces a usable key rather than
  // blocking the save.
  keyPrefix: varchar("key_prefix", { length: 16 }),

  order: int("order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectSpecificationGroups = InferSelectModel<
  typeof SpecificationGroups
>;
export type InsertSpecificationGroups = InferInsertModel<
  typeof SpecificationGroups
>;
