import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  decimal,
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
  matchModes,
  relationshipAllocations,
  relationshipComparators,
  relationshipFamilies,
  relationshipGates,
  relationshipStatuses,
} from "../enum";
import {
  LookupTable,
  Operand,
  Predicate,
  PresenceSpec,
  RelationshipScope,
} from "../types";

// A RELATIONSHIP — how two items in a selection fit together.
//
// It references ATTRIBUTES, never products. Anything carrying the consumer
// operand participates; anything carrying the provider operand supplies
// capacity. That is the property that makes the catalog scale: a new SKU joins
// every existing rule the moment its values are filled in, with no rule edits.
//
// One row, one rule, authored in the admin — never in code. The evaluator in
// packages/services interprets these rows and knows nothing about PoE, cameras
// or switches. All meaning lives in the data.
//
// Operands are JSON rather than foreign keys on purpose. A rule side may be a
// product attribute, a buyer-supplied project variable, a count of matching
// items, or a constant — one operand type keeps a single evaluator instead of a
// special case per family. The referential guarantee comes from the service
// layer, which REFUSES to delete an attribute any rule references. That is the
// behaviour we want anyway: an FK cascade would silently delete a safety rule
// because someone tidied the library.
export const Relationships = mysqlTable(
  "Relationships",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    family: mysqlEnum("family", relationshipFamilies).notNull(),

    // Only `published` rules ever gate a buyer. A wrong rule blocks real sales
    // across the whole catalog the instant it is saved, so a rule is drafted,
    // previewed against a real selection, and only then published.
    status: mysqlEnum("status", relationshipStatuses)
      .default("draft")
      .notNull(),

    // What is being measured, and what supplies the limit. Null on the sides a
    // family does not use — presence has neither, conditional has no provider
    // (its lookup table IS the capacity). The service asserts what each family
    // requires.
    consumer: json("consumer").$type<Operand | null>(),
    provider: json("provider").$type<Operand | null>(),

    // Which items count as consumers / providers, in the one shared predicate
    // language. Null = anything carrying the operand's attribute.
    //
    // The provider-side filter is what expresses an ecosystem lock without
    // naming a brand in the rule: "providers are items whose wireless_protocol
    // is Jeweller". Modelled as an attribute both sides carry, the rule stays
    // brand-agnostic and a second vendor with the same radio just works.
    consumerWhen: json("consumer_when").$type<Predicate | null>(),
    providerWhen: json("provider_when").$type<Predicate | null>(),

    comparator: mysqlEnum("comparator", relationshipComparators)
      .default("lte")
      .notNull(),

    // For the match family on a multi-select: overlap, or subset.
    matchMode: mysqlEnum("match_mode", matchModes).default("any").notNull(),

    // Usable share of the provider capacity, in percent. Real designs never
    // load to 100% — a PoE budget wants ~20% spare, a UPS sits at 80%. Defaults
    // to 100 so a margin is always something an author chose, never something
    // they inherited without noticing.
    headroomPercent: int("headroom_percent").default(100).notNull(),

    // The ratio family's target: demand ÷ supply must stay at or below this
    // (20 = 20:1 uplink oversubscription).
    ratioLimit: decimal("ratio_limit", { precision: 10, scale: 2 }),

    // per_unit (default) = each provider unit is its own bin and must fit its
    // own share; pooled = all units act as one capacity. Two switches with
    // 130 W each are not one switch with 260 W.
    allocation: mysqlEnum("allocation", relationshipAllocations)
      .default("per_unit")
      .notNull(),

    // Budget mode: judge each consumer unit against the single best provider
    // value rather than summing (one camera's draw vs the per-port maximum).
    perItem: boolean("per_item").default(false).notNull(),

    // conditional only — the table the limit is read from, keyed by the item's
    // own other values.
    lookup: json("lookup").$type<LookupTable | null>(),

    // presence only — the trigger and what it requires.
    presence: json("presence").$type<PresenceSpec | null>(),

    gate: mysqlEnum("gate", relationshipGates).default("block").notNull(),

    // The one restriction that genuinely is not a product attribute: the market
    // a rule applies to. Null = everywhere.
    scope: json("scope").$type<RelationshipScope | null>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_relationships_family").on(table.family),
    index("idx_relationships_status").on(table.status),
  ],
);

export type SelectRelationships = InferSelectModel<typeof Relationships>;
export type InsertRelationships = InferInsertModel<typeof Relationships>;
