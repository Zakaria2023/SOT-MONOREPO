import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// The central partner-discount matrix: one whole-number percentage per partner
// capability (see partnerCapabilities in db/enum.ts). A partner's total
// discount is the sum of the percentages for every capability they hold, so
// these stack (stock 20 + pre_sell 10 = 30% off MSRP). One row per capability.
export const PartnerDiscounts = mysqlTable("PartnerDiscounts", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  capability: varchar("capability", { length: 50 }).notNull().unique(),
  percent: int("percent").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectPartnerDiscounts = InferSelectModel<typeof PartnerDiscounts>;
export type InsertPartnerDiscounts = InferInsertModel<typeof PartnerDiscounts>;
