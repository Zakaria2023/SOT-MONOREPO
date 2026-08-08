import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { notificationAudiences, notificationKinds } from "../enum";

// NOTIFICATIONS, PULLED NOT PUSHED.
//
// No websocket, no queue, no service worker. A row is written when something
// happens and the client asks for its unread ones. That is a deliberate stop:
// real-time delivery is a different problem — reconnection, fan-out, delivery
// guarantees — and none of it is needed to tell somebody their invoice is ready.
//
// Addressed to a Clerk user id rather than a Users row, because an admin is not
// in the Users table. The audience then decides WHICH inbox it lands in, since
// one person can be both a customer and a partner.
export const Notifications = mysqlTable(
  "Notifications",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    // Null means everyone in the audience — an admin notice with no particular
    // owner. A per-person row for every admin would fan out on every event.
    recipientClerkUserId: varchar("recipient_clerk_user_id", { length: 64 }),
    audience: mysqlEnum("audience", notificationAudiences).notNull(),

    kind: mysqlEnum("kind", notificationKinds).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),

    // Where to go when it is clicked. A relative path, never an absolute URL:
    // the same row is read by three apps on three hosts.
    href: varchar("href", { length: 500 }),

    // Null while unread. A timestamp rather than a boolean, because "when did
    // they see this" is a question that gets asked and a boolean cannot answer.
    readAt: timestamp("read_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_notifications_recipient").on(
      table.recipientClerkUserId,
      table.readAt,
    ),
    index("idx_notifications_audience").on(table.audience, table.readAt),
  ],
);

export type SelectNotifications = InferSelectModel<typeof Notifications>;
export type InsertNotifications = InferInsertModel<typeof Notifications>;
