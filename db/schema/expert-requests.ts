import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { expertQueues, expertRequestStatuses } from "../enum";
import { ProjectAnswers, ScenarioLine } from "../types";

// A12 — THE EXPERT DESK.
//
// Where a question goes when the system cannot answer it. Two queues in one
// table: the lifecycle is identical and the work is not, so they share the
// mechanics and are never shown in one list.
//
// A design question carries the SELECTION AND THE ANSWERS the buyer was looking
// at, snapshotted. Without them the expert re-creates the basket by hand from a
// description, and re-creates it slightly differently — then answers a question
// nobody asked. It is the same reasoning that snapshots project inputs onto a
// BOQ: validation runs again in someone else's hands and has to judge the same
// design the buyer was shown.
export const ExpertRequests = mysqlTable(
  "ExpertRequests",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),
    reference: varchar("reference", { length: 50 }).notNull().unique(),

    queue: mysqlEnum("queue", expertQueues).notNull(),
    status: mysqlEnum("status", expertRequestStatuses)
      .default("open")
      .notNull(),

    // Who asked. Held by Clerk id with the name denormalised, so the queue still
    // reads after somebody leaves and their profile goes.
    askedByClerkUserId: varchar("asked_by_clerk_user_id", { length: 64 }),
    askedByName: varchar("asked_by_name", { length: 255 }),

    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),

    // design_help only. The basket and the answers, exactly as the buyer had
    // them.
    selection: json("selection").$type<ScenarioLine[] | null>(),
    variables: json("variables").$type<ProjectAnswers | null>(),

    // document_review only. The R2 document id the importer could not read.
    documentId: varchar("document_id", { length: 64 }),

    // Claiming is what stops two experts answering the same question and
    // contradicting each other in front of a customer.
    claimedBy: varchar("claimed_by", { length: 255 }),
    claimedAt: timestamp("claimed_at"),

    answer: text("answer"),
    answeredBy: varchar("answered_by", { length: 255 }),
    answeredAt: timestamp("answered_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_expert_requests_queue").on(table.queue, table.status),
    index("idx_expert_requests_asker").on(table.askedByClerkUserId),
  ],
);

export type SelectExpertRequests = InferSelectModel<typeof ExpertRequests>;
export type InsertExpertRequests = InferInsertModel<typeof ExpertRequests>;
