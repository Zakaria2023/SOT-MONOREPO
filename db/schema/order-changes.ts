import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
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
import { orderChangeStatuses } from "../enum";
import { Orders } from "./orders";
import { ScenarioLine } from "../types";

// A13 — CHANGING AN ORDER AFTER IT IS PLACED.
//
// Orders were immutable, which is not how installations work: a site visit finds
// one more door than the drawing showed, and something has to happen. Editing
// OrderItems in place would have been the obvious move and is the wrong one — the
// order snapshots the design findings it was judged against, and quietly swapping
// the lines underneath leaves it claiming a clean bill of health for a basket it
// no longer contains.
//
// So a change is a ROW. It carries the proposed lines, the verdict the engine
// gave them, and who asked. Applying it re-runs the gate and rewrites the order's
// own snapshot, so "what was this judged against" stays answerable at every
// point.
export const OrderChanges = mysqlTable(
  "OrderChanges",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),
    reference: varchar("reference", { length: 50 }).notNull().unique(),

    orderUuid: char("order_uuid", { length: 36 }).notNull(),

    status: mysqlEnum("status", orderChangeStatuses)
      .default("proposed")
      .notNull(),

    // Why. Required by the service — a change to a placed order with no stated
    // reason is one nobody can explain to the customer who is paying for it.
    reason: text("reason").notNull(),

    // The order's lines as they WOULD be. The whole basket, not a delta: a diff
    // has to be applied to a known base, and the base moves the moment another
    // change lands first.
    lines: json("lines").$type<ScenarioLine[]>().notNull(),

    // What the engine said about those lines, at proposal. Kept even when the
    // change is rejected — "we turned this down because it broke the design" is
    // the record that stops it being proposed again next week.
    designFindings: json("design_findings").$type<
      { id: string; title: string; message: string; tone: string }[]
    >(),

    // What the order would total. Recorded at proposal so the difference is
    // visible before anybody agrees to it.
    grandTotal: decimal("grand_total", { precision: 12, scale: 2 }),

    proposedBy: varchar("proposed_by", { length: 255 }),
    decidedBy: varchar("decided_by", { length: 255 }),
    decidedAt: timestamp("decided_at"),
    // Why it was turned down, or the override reason if it was pushed through
    // despite the engine.
    decisionNote: text("decision_note"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orderUuid],
      foreignColumns: [Orders.uuid],
      name: "fk_order_changes_order",
    }).onDelete("cascade"),
    index("idx_order_changes_order").on(table.orderUuid, table.status),
  ],
);

export type SelectOrderChanges = InferSelectModel<typeof OrderChanges>;
export type InsertOrderChanges = InferInsertModel<typeof OrderChanges>;
