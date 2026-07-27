import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { catalogAuditActions, catalogAuditTargets } from "../enum";

// The audit trail for the catalog model. Relationships and assignments are the
// things that get blamed when a sale is blocked — "why did this cart stop?" has
// to be answerable, and "who turned this rule on?" is the second question every
// time.
//
// Deliberately append-only and denormalised: it stores the label at the time of
// the change, so the trail still reads correctly after the attribute it refers
// to has been renamed or deleted.
export const CatalogAudit = mysqlTable(
  "CatalogAudit",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    target: mysqlEnum("target", catalogAuditTargets).notNull(),
    action: mysqlEnum("action", catalogAuditActions).notNull(),

    // The row that changed, and what it was called at the time.
    targetUuid: char("target_uuid", { length: 36 }).notNull(),
    targetLabel: varchar("target_label", { length: 255 }).notNull(),

    // Who did it — the Clerk-backed staff user. Null only for system actions
    // (migrations, imports).
    actorUuid: char("actor_uuid", { length: 36 }),
    actorName: varchar("actor_name", { length: 255 }),

    // Field-level before/after, so a rule's headroom changing from 100 to 80 is
    // visible without diffing two snapshots by hand.
    changes: json("changes").$type<
      { field: string; from: unknown; to: unknown }[]
    >(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_catalog_audit_target").on(table.target, table.targetUuid),
    index("idx_catalog_audit_created").on(table.createdAt),
  ],
);

export type SelectCatalogAudit = InferSelectModel<typeof CatalogAudit>;
export type InsertCatalogAudit = InferInsertModel<typeof CatalogAudit>;
