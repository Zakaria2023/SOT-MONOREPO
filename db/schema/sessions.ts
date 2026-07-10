import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { Users } from "./users";

export const Sessions = mysqlTable(
  "Sessions",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    userUuid: char("user_uuid", { length: 36 })
      .notNull()
      .references(() => Users.uuid, { onDelete: "cascade" }),

    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),

    expiresAt: timestamp("expires_at").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_sessions_user_uuid").on(table.userUuid),
    index("idx_sessions_token_hash").on(table.tokenHash),
  ],
);

export type SelectSessions = InferSelectModel<typeof Sessions>;
export type InsertSessions = InferInsertModel<typeof Sessions>;
