import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { serviceRequestKinds, serviceRequestStatuses } from "../enum";
import { SpaceItems, Spaces } from "./spaces";
import { Users } from "./users";

// ---------------------------------------------------------------------------
// 6.2 — A CALLOUT.
//
// Somebody asking for a person to come to a building.
//
// NOT `ExpertRequests`, which was the obvious place to put it. That table's own
// comment explains why two queues share it — "the lifecycle is identical and the
// work is not" — and that is exactly the test this fails. An expert request is a
// QUESTION answered from a desk; a callout has a date, a van, and somebody with
// keys letting them in. `scheduled` has no equivalent in a question queue, and it
// is the state a customer most wants to see.
//
// It points at the Space, and optionally at ONE ITEM in it. That second link is
// what turns the service schedule into work: a detector whose sensor expires in
// 2036 produces a request naming that detector, and the engineer knows which unit
// to bring a part for before they leave.
// ---------------------------------------------------------------------------

export const ServiceRequests = mysqlTable(
  "ServiceRequests",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),
    reference: varchar("reference", { length: 50 }).notNull().unique(),

    spaceUuid: char("space_uuid", { length: 36 })
      .notNull()
      .references(() => Spaces.uuid, { onDelete: "cascade" }),

    // The specific unit, when there is one. Null for "the system is down" and for
    // a routine inspection of the whole site.
    //
    // `set null` rather than cascade: retiring the very item the visit was about
    // must not delete the record of the visit. That record is the history that
    // explains why it was replaced.
    itemUuid: char("item_uuid", { length: 36 }).references(
      () => SpaceItems.uuid,
      { onDelete: "set null" },
    ),

    // Who asked. By profile row rather than Clerk id, because a callout belongs to
    // the site's owner and that is who the Space is keyed to.
    raisedByUserUuid: char("raised_by_user_uuid", { length: 36 })
      .notNull()
      .references(() => Users.uuid, { onDelete: "restrict" }),

    kind: mysqlEnum("kind", serviceRequestKinds).notNull(),
    status: mysqlEnum("status", serviceRequestStatuses)
      .default("open")
      .notNull(),

    // In the customer's words. Required — a visit request with no description is
    // an engineer arriving with no idea what to bring.
    detail: text("detail").notNull(),

    // WHAT THE SCHEDULE SAID WHEN THIS WAS RAISED, snapshotted.
    //
    // Same reasoning as the design findings on an order. The clock will have moved
    // on by the time anybody reads this, and "why was a visit booked" has to stay
    // answerable — a request raised because a sensor was three weeks from expiry
    // reads very differently in two years when the date is long past.
    dueReason: varchar("due_reason", { length: 500 }),

    // When somebody is going. A calendar date rather than a timestamp: a visit is
    // booked for a day, and the hour is arranged by phone.
    scheduledFor: date("scheduled_for", { mode: "string" }),
    scheduledBy: varchar("scheduled_by", { length: 255 }),

    attendedAt: timestamp("attended_at"),
    // What was actually done. The other half of the history.
    outcome: text("outcome"),

    closedAt: timestamp("closed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_service_requests_space_uuid").on(table.spaceUuid),
    index("idx_service_requests_item_uuid").on(table.itemUuid),
    index("idx_service_requests_status").on(table.status),
    index("idx_service_requests_raised_by").on(table.raisedByUserUuid),
  ],
);

export type SelectServiceRequests = InferSelectModel<typeof ServiceRequests>;
export type InsertServiceRequests = InferInsertModel<typeof ServiceRequests>;
