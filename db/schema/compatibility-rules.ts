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
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  ruleAllocations,
  ruleComparators,
  ruleKinds,
  ruleSeverities,
} from "../enum";
import { RuleCondition } from "../types";
import { Specifications } from "./specifications";

// A compatibility rule — one row per rule, created from the admin rule
// builder, never from code. Rules bind to specifications, not products: any
// product carrying the consumer spec participates, any product carrying the
// provider spec supplies capacity, so new products join existing rules with
// zero changes. The generic evaluator in packages/services interprets these
// rows; it knows nothing about PoE, cameras, or switches.
export const CompatibilityRules = mysqlTable(
  "CompatibilityRules",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    kind: mysqlEnum("kind", ruleKinds).notNull(),

    // The numeric spec measured on consuming items (e.g. Power Consumption).
    consumerSpecUuid: char("consumer_spec_uuid", { length: 36 }).notNull(),
    // The numeric spec supplying capacity (e.g. PoE Budget).
    providerSpecUuid: char("provider_spec_uuid", { length: 36 }).notNull(),

    comparator: mysqlEnum("comparator", ruleComparators)
      .default("lte")
      .notNull(),

    // Usable share of the provider capacity, in percent — real designs never
    // load to 100% (e.g. 90 = demand must fit within 90% of the budget).
    headroomPercent: int("headroom_percent").default(100).notNull(),

    // pooled: providers act as one pool; per_provider: consumers are
    // distributed across provider units and each unit must fit its share.
    allocation: mysqlEnum("allocation", ruleAllocations)
      .default("pooled")
      .notNull(),

    // Optional consumer-side filter (e.g. only items with PoE = "Yes").
    condition: json("condition").$type<RuleCondition | null>(),

    severity: mysqlEnum("severity", ruleSeverities).default("block").notNull(),
    enabled: boolean("enabled").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  // FK constraints are named explicitly — the auto-generated names exceed
  // MySQL's 64-char identifier limit.
  (table) => [
    index("idx_compat_rules_consumer_spec").on(table.consumerSpecUuid),
    index("idx_compat_rules_provider_spec").on(table.providerSpecUuid),
    foreignKey({
      name: "fk_compat_rules_consumer_spec",
      columns: [table.consumerSpecUuid],
      foreignColumns: [Specifications.uuid],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_compat_rules_provider_spec",
      columns: [table.providerSpecUuid],
      foreignColumns: [Specifications.uuid],
    }).onDelete("cascade"),
  ],
);

export type SelectCompatibilityRules = InferSelectModel<
  typeof CompatibilityRules
>;
export type InsertCompatibilityRules = InferInsertModel<
  typeof CompatibilityRules
>;
