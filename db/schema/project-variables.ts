import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  decimal,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// A typed input to a DESIGN rather than a property of a product — "expected
// concurrent calls", "retention days", "peak occupancy". Rules read these the
// same way they read a product spec, which is what lets a rule compare demand
// nobody sells against capacity somebody does: a PBX's max concurrent calls is
// a spec on a product, but the calls you actually expect is a project decision.
//
// Definitions only. The values live per-BOQ in Boqs.variableValues, so two
// designs can answer the same question differently.
export const ProjectVariables = mysqlTable("ProjectVariables", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  label: varchar("label", { length: 255 }).notNull(),
  // Stable key a BOQ stores its answer under, derived from the label.
  key: varchar("key", { length: 255 }).notNull(),
  description: text("description"),

  // Variables are always numeric — a rule compares them arithmetically. The
  // unit is compared against the spec on the other side of the rule, exactly
  // as two specs are.
  unit: varchar("unit", { length: 32 }),

  // Used when a BOQ has not answered this question yet, so a rule still has a
  // number to work with instead of silently not applying.
  defaultValue: decimal("default_value", { precision: 12, scale: 2 }),

  order: int("order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectProjectVariables = InferSelectModel<typeof ProjectVariables>;
export type InsertProjectVariables = InferInsertModel<typeof ProjectVariables>;
