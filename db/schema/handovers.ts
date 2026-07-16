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
import { handoverCredentialTypes, handoverStatuses } from "../enum";
import { BoqItems, Boqs } from "./boqs";

// The handover pack IS the completed BOQ: one pack per BOQ, holding the QA
// lifecycle plus the dual sign-off. It lives permanently in the customer's SOT
// account — the "good lock-in" — so it references the BOQ (not the order) and
// is never deleted with an order.
export const HandoverPacks = mysqlTable(
  "HandoverPacks",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    boqUuid: char("boq_uuid", { length: 36 })
      .notNull()
      .unique()
      .references(() => Boqs.uuid, { onDelete: "restrict" }),

    // The partner who assembled the pack (Clerk id), snapshotted for the record.
    partnerClerkUserId: varchar("partner_clerk_user_id", { length: 64 }),

    status: mysqlEnum("status", handoverStatuses).default("draft").notNull(),

    // Client training delivered as part of handover (free-text notes / summary).
    trainingNotes: text("training_notes"),

    // Dual sign-off. The customer confirms their access works; SOT does the
    // remote completeness check. A dispute records why.
    customerConfirmedAt: timestamp("customer_confirmed_at"),
    sotVerifiedByClerkUserId: varchar("sot_verified_by_clerk_user_id", {
      length: 64,
    }),
    sotVerifiedByName: varchar("sot_verified_by_name", { length: 255 }),
    sotVerifiedAt: timestamp("sot_verified_at"),
    disputeReason: text("dispute_reason"),

    submittedAt: timestamp("submitted_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_handover_packs_boq_uuid").on(table.boqUuid)],
);

// An as-built asset record — one per installed device. Seeded from the BOQ's
// product lines (make/model, quantity) then completed with install reality:
// where it went, its local IP, port, and photo evidence.
export const HandoverAssets = mysqlTable(
  "HandoverAssets",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    packUuid: char("pack_uuid", { length: 36 })
      .notNull()
      .references(() => HandoverPacks.uuid, { onDelete: "cascade" }),
    // The BOQ line this asset was built from, if any (service lines have none).
    boqItemUuid: char("boq_item_uuid", { length: 36 }).references(
      () => BoqItems.uuid,
      { onDelete: "set null" },
    ),

    name: varchar("name", { length: 255 }).notNull(), // make/model
    location: varchar("location", { length: 255 }), // where it was installed
    localIp: varchar("local_ip", { length: 45 }), // the direct access path
    port: varchar("port", { length: 20 }),
    macAddress: varchar("mac_address", { length: 17 }),
    serialNumber: varchar("serial_number", { length: 100 }),
    // R2 document id for the photo evidence.
    photo: varchar("photo", { length: 64 }),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_handover_assets_pack_uuid").on(table.packUuid),
    index("idx_handover_assets_boq_item_uuid").on(table.boqItemUuid),
  ],
);

// The credentials that transfer control: offline user/password, cloud-project
// admin ownership, or a single device login. Storing secrets is sensitive —
// `secret` must be encrypted at rest by the application layer, never written
// in plaintext (see the service comments).
export const HandoverCredentials = mysqlTable(
  "HandoverCredentials",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    packUuid: char("pack_uuid", { length: 36 })
      .notNull()
      .references(() => HandoverPacks.uuid, { onDelete: "cascade" }),

    type: mysqlEnum("type", handoverCredentialTypes).notNull(),

    label: varchar("label", { length: 255 }).notNull(),
    // Where the credential is used (device IP, cloud console URL, app name).
    target: varchar("target", { length: 255 }),
    username: varchar("username", { length: 255 }),
    // Encrypted at rest — never plaintext.
    secret: text("secret"),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_handover_credentials_pack_uuid").on(table.packUuid)],
);

export type SelectHandoverPacks = InferSelectModel<typeof HandoverPacks>;
export type InsertHandoverPacks = InferInsertModel<typeof HandoverPacks>;
export type SelectHandoverAssets = InferSelectModel<typeof HandoverAssets>;
export type InsertHandoverAssets = InferInsertModel<typeof HandoverAssets>;
export type SelectHandoverCredentials = InferSelectModel<
  typeof HandoverCredentials
>;
export type InsertHandoverCredentials = InferInsertModel<
  typeof HandoverCredentials
>;
