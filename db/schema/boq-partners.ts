import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// One row per (BOQ, partner) the pre-seller dispatched a reviewed BOQ to. The
// partner is a Clerk user, so their name/location are denormalized here.
export const BoqPartners = mysqlTable(
  "BoqPartners",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    boqUuid: char("boq_uuid", { length: 36 }).notNull(),

    partnerClerkUserId: varchar("partner_clerk_user_id", {
      length: 64,
    }).notNull(),
    partnerRequestUuid: char("partner_request_uuid", { length: 36 }),
    partnerName: varchar("partner_name", { length: 255 }),
    partnerLocation: varchar("partner_location", { length: 255 }),

    // The pre-seller's note written for this specific partner in the send dialog.
    preSellerComment: text("pre_seller_comment"),

    // 1 = closest match, ascending.
    matchRank: int("match_rank").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_boq_partners_boq_uuid").on(table.boqUuid),
    index("idx_boq_partners_partner").on(table.partnerClerkUserId),
  ],
);

export type SelectBoqPartners = InferSelectModel<typeof BoqPartners>;
export type InsertBoqPartners = InferInsertModel<typeof BoqPartners>;
