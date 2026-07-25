import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  decimal,
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
import { LookupTable, RuleCondition } from "../types";
import { ProjectVariables } from "./project-variables";
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

    // Each side of a rule is ONE operand: either a product spec or a project
    // variable, never both. Nullable because not every family fills both
    // sides — a conditional rule's capacity is its lookup table, and a rule
    // whose demand is a project decision (expected concurrent calls) has no
    // consumer spec at all. The service asserts exactly one operand per side.
    //
    // The numeric spec measured on consuming items (e.g. Power Consumption).
    consumerSpecUuid: char("consumer_spec_uuid", { length: 36 }),
    // The numeric spec supplying capacity (e.g. PoE Budget).
    providerSpecUuid: char("provider_spec_uuid", { length: 36 }),

    // A project variable standing in for the demand side — the number nobody
    // sells (expected concurrent calls, retention days), answered per BOQ.
    consumerVariableUuid: char("consumer_variable_uuid", { length: 36 }),
    // A project variable standing in for the capacity side. Rarer, but a
    // designed cap (e.g. an agreed maximum spend of ports) belongs here.
    providerVariableUuid: char("provider_variable_uuid", { length: 36 }),

    // "conditional" only: the table the limit is read from, keyed by the
    // item's own other spec values. Null for every other family.
    lookup: json("lookup").$type<LookupTable | null>(),

    comparator: mysqlEnum("comparator", ruleComparators)
      .default("lte")
      .notNull(),

    // Usable share of the provider capacity, in percent — real designs never
    // load to 100% (e.g. 90 = demand must fit within 90% of the budget).
    headroomPercent: int("headroom_percent").default(100).notNull(),

    // The target ratio for a "ratio" rule: demand ÷ supply must stay ≤ this
    // (e.g. 20 = 20:1 uplink oversubscription). Null for the other kinds.
    ratioLimit: decimal("ratio_limit", { precision: 10, scale: 2 }),

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
    foreignKey({
      name: "fk_compat_rules_consumer_var",
      columns: [table.consumerVariableUuid],
      foreignColumns: [ProjectVariables.uuid],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_compat_rules_provider_var",
      columns: [table.providerVariableUuid],
      foreignColumns: [ProjectVariables.uuid],
    }).onDelete("cascade"),
  ],
);

export type SelectCompatibilityRules = InferSelectModel<
  typeof CompatibilityRules
>;
export type InsertCompatibilityRules = InferInsertModel<
  typeof CompatibilityRules
>;
