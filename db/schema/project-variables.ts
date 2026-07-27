import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { projectVariableTypes } from "../enum";

// A PROJECT VARIABLE — a number the BUYER supplies, not one a product carries.
//
// Some rules are not about products at all. "Expected concurrent calls ≤ PBX
// capacity" and "access demand ÷ uplink capacity ≤ 20:1" need an input from the
// person designing the system. Without a home for these, the whole Ratio family
// and several Count rules cannot be expressed.
//
// Deliberately the same shape as a library attribute — name, type, unit,
// default — so it slots into a relationship as an operand with no special case
// in the evaluator, and so the guided-selling questionnaire has somewhere to
// put its answers later.
export const ProjectVariables = mysqlTable("ProjectVariables", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  // Shown to the buyer, so it has to read as a question a non-expert can
  // answer: "How many calls do you expect at the same time?"
  label: varchar("label", { length: 255 }).notNull(),
  // Slug for exports and the AI read model only. Nothing points at it.
  key: varchar("key", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }),

  type: mysqlEnum("type", projectVariableTypes).default("number").notNull(),
  unit: varchar("unit", { length: 32 }),

  // Used when the buyer has not answered. Null means there is no sensible
  // default — and a rule whose variable has no value simply does not run,
  // rather than running on a number nobody supplied.
  defaultValue: decimal("default_value", { precision: 14, scale: 4 }),

  order: int("order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectProjectVariables = InferSelectModel<typeof ProjectVariables>;
export type InsertProjectVariables = InferInsertModel<typeof ProjectVariables>;
