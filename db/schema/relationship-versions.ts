import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  foreignKey,
  int,
  json,
  mysqlTable,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { RelationshipSnapshot } from "../types";
import { Relationships } from "./relationships";

// EVERY STATE A RULE HAS BEEN IN.
//
// CatalogAudit already records that a rule changed, and who changed it. What it
// cannot do is put it back: it stores a field-level diff, and only for three
// scalar fields. The operands, the side filters, the lookup table and the
// presence spec — the parts somebody actually breaks — are not in it at all.
//
// So this stores the whole authored rule after every save. A version is a
// snapshot and not a diff, because reconstructing a JSON predicate tree by
// replaying diffs is exactly the kind of clever that fails quietly on the day
// you need it.
//
// Restoring is a FORWARD operation: it writes the old snapshot through the
// normal update path, which records a new version of its own. History is never
// rewritten, and a restore that would resurrect a rule naming a since-deleted
// attribute is refused by the same validation as any other save.
export const RelationshipVersions = mysqlTable(
  "RelationshipVersions",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    relationshipUuid: char("relationship_uuid", { length: 36 }).notNull(),

    // 1 for the state the rule was created in, then one per save. The unique
    // constraint below is what makes two simultaneous saves fail loudly instead
    // of quietly writing two version 4s.
    version: int("version").notNull(),

    snapshot: json("snapshot").$type<RelationshipSnapshot>().notNull(),

    // The rule's name at the time, denormalised so a version list still reads
    // correctly after a rename — the same reasoning CatalogAudit uses.
    name: varchar("name", { length: 255 }).notNull(),

    actorUuid: char("actor_uuid", { length: 36 }),
    actorName: varchar("actor_name", { length: 255 }),

    // Why this version exists, when it was not an ordinary edit — "restored
    // from v3". Null for a normal save, where the diff says everything.
    note: varchar("note", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.relationshipUuid],
      foreignColumns: [Relationships.uuid],
      name: "fk_relationship_versions_relationship",
    }).onDelete("cascade"),
    unique("uq_relationship_versions_number").on(
      table.relationshipUuid,
      table.version,
    ),
  ],
);

export type SelectRelationshipVersions = InferSelectModel<
  typeof RelationshipVersions
>;
export type InsertRelationshipVersions = InferInsertModel<
  typeof RelationshipVersions
>;
