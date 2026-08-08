import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { partnerCapabilities, partnerCapabilityActions } from "../enum";
import { PartnerRequests } from "./partner-requests";

// HOW A PARTNER CAME TO BE ALLOWED TO DO WHAT THEY DO.
//
// The capabilities themselves stay on PartnerRequests.capabilities, and that
// array remains the single truth — it is what prices the account, and splitting
// the live set across two places is how a partner ends up billed at one rate and
// shown another.
//
// This is the explanation, not the state. The same relationship CatalogAudit has
// to the rows it describes.
//
// It matters more here than it looks, because a capability is not just a
// permission: the discount is the sum of the percentages for every capability
// held. Granting one changes what that partner pays, immediately, for everything
// they buy. "Who widened this partner's discount, when, and why" has to be
// answerable.
export const PartnerCapabilityLog = mysqlTable(
  "PartnerCapabilityLog",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    partnerUuid: char("partner_uuid", { length: 36 }).notNull(),

    capability: mysqlEnum("capability", partnerCapabilities).notNull(),
    action: mysqlEnum("action", partnerCapabilityActions).notNull(),

    actorName: varchar("actor_name", { length: 255 }),
    // Required on a revoke. A capability taken away with no reason recorded is
    // one nobody can defend when the partner asks.
    reason: text("reason"),

    // What the discount became, so the trail explains the money as well as the
    // permission. Recorded rather than recomputed later: the percentage matrix
    // itself moves, and replaying it against today's numbers would misreport
    // what this partner was actually charged.
    discountPercentAfter: int("discount_percent_after"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.partnerUuid],
      foreignColumns: [PartnerRequests.uuid],
      name: "fk_partner_capability_log_partner",
    }).onDelete("cascade"),
    index("idx_partner_capability_log_partner").on(table.partnerUuid),
  ],
);

export type SelectPartnerCapabilityLog = InferSelectModel<
  typeof PartnerCapabilityLog
>;
export type InsertPartnerCapabilityLog = InferInsertModel<
  typeof PartnerCapabilityLog
>;
