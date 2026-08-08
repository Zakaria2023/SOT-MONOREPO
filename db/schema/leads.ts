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
import { leadOfferStatuses, leadStatuses } from "../enum";
import { Users } from "./users";

// ---------------------------------------------------------------------------
// 7.3 — LEADS.
//
// A B2C enquiry, qualified, then routed to a partner.
//
// THE GATE IS QUALIFICATION, and it is the only reason this channel is worth
// having. Raw enquiries are tyre-kickers; a partner who is sent four of them stops
// opening the feed, and then the fifth — which was real — goes nowhere. So a lead
// is not released to anybody until somebody has established what system it is for,
// roughly how big, where, and that the person on the other end is contactable.
//
// QUALIFICATION IS RULES, NOT A SCORE. There is no `score` column here and there
// will not be one. A number tells a partner nothing they can act on and tells
// whoever qualified it nothing about what is missing — "62" is not a reason. The
// four facts either exist or they do not, and `lead-qualification.ts` names the
// ones that do not.
//
// ROUTING IS AN OFFER, NOT AN ASSIGNMENT. A lead handed to the nearest partner is
// a lead that sits with whoever happens to be closest while they are on holiday. So
// it is offered, with a clock on it, and it cascades. Each offer is its own row —
// three partners may have each let one lapse before the fourth takes it, and a
// single `assignedPartner` column could not hold that.
// ---------------------------------------------------------------------------

export const Leads = mysqlTable(
  "Leads",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),
    reference: varchar("reference", { length: 50 }).notNull().unique(),

    status: mysqlEnum("status", leadStatuses).default("new").notNull(),

    // ---- Who enquired. ----
    //
    // Free text, not a Users reference. A marketing lead arrives from a form or a
    // phone call and there is no account behind it — requiring one would mean
    // creating a user for every tyre-kicker, which is exactly what qualification
    // exists to avoid.
    contactName: varchar("contact_name", { length: 255 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 40 }),
    contactEmail: varchar("contact_email", { length: 255 }),

    // Set only if they turn out to have (or later create) an account. Null is the
    // normal state.
    userUuid: char("user_uuid", { length: 36 }).references(() => Users.uuid, {
      onDelete: "set null",
    }),

    // Where it came from — "Instagram", "website form", "trade show". Free text
    // because marketing invents channels faster than anybody migrates an enum.
    source: varchar("source", { length: 120 }),
    // What they actually said.
    enquiry: text("enquiry"),

    // ---- The four qualification facts. ----
    //
    // Each nullable, because a new lead has none of them, and each named rather
    // than folded into a score. `lead-qualification.ts` decides what a complete set
    // looks like.

    // Which systems they want. An array because "cameras and an alarm" is one
    // enquiry and two systems, and splitting it into two leads would double-chase
    // the same person.
    systems: json("systems").$type<string[]>(),

    // Roughly how big. A band, not a number: nobody enquiring knows how many
    // cameras they need, and a precise figure here would be a fiction that survives
    // into a quote.
    sizeBand: varchar("size_band", { length: 60 }),

    city: varchar("city", { length: 120 }),
    // For routing. Nullable — a lead can be qualified without one, and then routes
    // by city rather than by distance.
    latitude: varchar("latitude", { length: 24 }),
    longitude: varchar("longitude", { length: 24 }),

    // Whether anybody has actually spoken to them. The fact that separates a real
    // enquiry from a form fill by a bot, and the one a partner cares about most.
    contactVerifiedAt: timestamp("contact_verified_at"),
    contactVerifiedBy: varchar("contact_verified_by", { length: 255 }),

    qualifiedAt: timestamp("qualified_at"),
    qualifiedBy: varchar("qualified_by", { length: 255 }),
    // Why it was turned down. Kept rather than deleted: the reason is what stops the
    // same enquiry being chased again next month.
    rejectedReason: varchar("rejected_reason", { length: 500 }),

    // ---- The outcome. ----
    //
    // Conversion tracking. The BOQ that came out of it, when one did — which is how
    // anybody ever finds out whether the channel pays for itself.
    convertedBoqUuid: char("converted_boq_uuid", { length: 36 }),
    convertedAt: timestamp("converted_at"),
    lostReason: varchar("lost_reason", { length: 500 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_leads_status").on(table.status),
    index("idx_leads_city").on(table.city),
    index("idx_leads_user_uuid").on(table.userUuid),
  ],
);

// One offer of one lead to one partner.
export const LeadOffers = mysqlTable(
  "LeadOffers",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    leadUuid: char("lead_uuid", { length: 36 })
      .notNull()
      .references(() => Leads.uuid, { onDelete: "cascade" }),

    partnerClerkUserId: varchar("partner_clerk_user_id", { length: 64 }).notNull(),
    partnerName: varchar("partner_name", { length: 255 }),

    status: mysqlEnum("status", leadOfferStatuses).default("offered").notNull(),

    // Which round of the cascade this was. 1 is the nearest partner. Stored rather
    // than counted, so "we tried four before anybody took it" survives even after
    // an offer row is tidied away.
    cascadeRound: int("cascade_round").default(1).notNull(),

    // THE CLOCK. An offer with no expiry is an assignment, and an assignment to a
    // partner who is away is a lead nobody works. When this passes the offer lapses
    // and the next partner is tried.
    expiresAt: timestamp("expires_at").notNull(),

    respondedAt: timestamp("responded_at"),
    declinedReason: varchar("declined_reason", { length: 500 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_lead_offers_lead").on(table.leadUuid),
    index("idx_lead_offers_partner").on(table.partnerClerkUserId),
    index("idx_lead_offers_status").on(table.status),
    index("idx_lead_offers_expires_at").on(table.expiresAt),
  ],
);

export type SelectLeads = InferSelectModel<typeof Leads>;
export type InsertLeads = InferInsertModel<typeof Leads>;
export type SelectLeadOffers = InferSelectModel<typeof LeadOffers>;
export type InsertLeadOffers = InferInsertModel<typeof LeadOffers>;
