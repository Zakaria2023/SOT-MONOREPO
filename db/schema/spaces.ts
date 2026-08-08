import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { Boqs } from "./boqs";
import { Products } from "./products";
import { Users } from "./users";

// ---------------------------------------------------------------------------
// A SPACE IS A PHYSICAL SITE, AND IT OUTLIVES THE SALE.
//
// Everything before this models a transaction: a design, a quote, an order, a
// handover. All of it ends. A Space is the object that does not — the building
// with the equipment in it, which the customer still owns next year when a
// detector reaches end of life and somebody has to go and change it.
//
// WHY IT IS NOT `HandoverAssets`. That table already records installed devices,
// and duplicating it would be the obvious mistake. It is a different kind of
// thing: a HandoverAsset belongs to one PACK, and it is evidence of what was
// installed on the day, complete with the photo. It must never change, because a
// document that gets edited is not evidence.
//
// A Space is a REGISTER, not a document. It accumulates across many jobs, and its
// facts move: firmware is updated, a unit is swapped, three more cameras go in
// two years later. And decisively, a HandoverAsset has no `productUuid` — only a
// free-text make/model and a link to the BOQ line — so nothing about it can reach
// the specification library, and no rule can be run against it. A register that
// cannot be checked is a list.
//
// So the Space is POPULATED FROM the handover and then lives its own life.
// ---------------------------------------------------------------------------

export const Spaces = mysqlTable(
  "Spaces",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    // The owner. `restrict` rather than cascade: deleting a customer must not
    // silently take the record of a building's fire system with it.
    userUuid: char("user_uuid", { length: 36 })
      .notNull()
      .references(() => Users.uuid, { onDelete: "restrict" }),

    // What the customer calls it — "Head office", "Villa 12", "Warehouse B".
    // Their words, because they are the ones who will have to recognise it in a
    // list when they ring up about a fault.
    name: varchar("name", { length: 255 }).notNull(),

    // Free-shape, because an address is not a schema. A site can be a plot
    // number, a building and floor, or a set of coordinates on a compound with no
    // street, and columns for one of those shapes force the others into a
    // "line 2" that means nothing.
    address: json("address").$type<{
      line?: string;
      district?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      notes?: string;
    }>(),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_spaces_user_uuid").on(table.userUuid)],
);

// One entry in the register: a device, or a batch of identical devices, that is
// installed at this site right now.
export const SpaceItems = mysqlTable(
  "SpaceItems",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    spaceUuid: char("space_uuid", { length: 36 })
      .notNull()
      .references(() => Spaces.uuid, { onDelete: "cascade" }),

    // THE LINK THE HANDOVER RECORD LACKS, and the reason this table exists. With
    // a product uuid the item's specification values are reachable, so a rule can
    // be run against what is actually installed rather than against a basket
    // somebody is thinking about buying.
    //
    // `set null` rather than restrict: a product can be withdrawn from the
    // catalogue, and the device does not leave the wall when it is.
    productUuid: char("product_uuid", { length: 36 }).references(
      () => Products.uuid,
      { onDelete: "set null" },
    ),

    // Snapshotted BECAUSE of that. When the catalogue row goes, this is all that
    // is left to identify what is on the wall — and "unknown device" in a fire
    // system is worse than a stale model number.
    name: varchar("name", { length: 255 }).notNull(),

    // A batch of identical units whose individual identity nobody tracked. The
    // service layer refuses a quantity above 1 on a row carrying a serial or a
    // firmware version, because those are facts about ONE device and a row
    // claiming five units at one serial number is not a record of anything.
    quantity: int("quantity").default(1).notNull(),

    // Where in the building. The single most useful field when somebody has to
    // find the unit that is beeping.
    location: varchar("location", { length: 255 }),

    // The clock every replacement date is counted from, so it is a date and not a
    // timestamp — nobody installs a smoke detector at 14:32 in a way that matters
    // ten years later.
    //
    // `mode: "string"` because a calendar date has no timezone, and a `Date` gives
    // it one. An install recorded as 2026-08-08 read back through a UTC offset
    // becomes the 7th, and a ten-year replacement date computed from the 7th is
    // wrong in a way nobody would ever look for.
    installedAt: date("installed_at", { mode: "string" }),

    // ---- The mutable properties. ----
    //
    // Firmware is the reason the whole object was asked for. Some rules depend on
    // it: the UL detector needs OS Malevich 2.15.4 or later, gen-1 FireProtect
    // interconnection needs 3.42 or later. It is a property of an ALREADY
    // INSTALLED device, which is why no BOQ line could ever carry it.
    firmwareVersion: varchar("firmware_version", { length: 50 }),

    // AND SOT CANNOT CHECK IT. Nobody here can read the firmware off a panel in a
    // building three cities away; the number came from a person typing what they
    // believed. So this defaults to FALSE and any rule that reads the version
    // above must degrade to a WARNING while it is false — never a hard block.
    //
    // The flag exists rather than being assumed because the alternative is worse
    // than having no check: a rule that silently trusts a self-declared number
    // looks like verification and is not, and a design passed on that basis has
    // been approved by nobody.
    firmwareVerified: boolean("firmware_verified").default(false).notNull(),
    // Who claimed it, and when. An unverified number with no author cannot even
    // be chased up.
    firmwareDeclaredBy: varchar("firmware_declared_by", { length: 255 }),
    firmwareDeclaredAt: timestamp("firmware_declared_at"),

    serial: varchar("serial", { length: 100 }),
    macAddress: varchar("mac_address", { length: 17 }),

    // ---- Provenance. ----
    //
    // Which job put it here. Null for an item the customer added by hand, which
    // is a genuinely different fact from one we installed — the second is
    // something SOT can stand behind and the first is not.
    boqUuid: char("boq_uuid", { length: 36 }).references(() => Boqs.uuid, {
      onDelete: "set null",
    }),

    // Retired, not deleted. A unit that has been swapped out is the history that
    // explains the next callout, and a register that forgets what used to be
    // there cannot answer "this is the third one of these to fail".
    retiredAt: timestamp("retired_at"),
    retiredReason: varchar("retired_reason", { length: 255 }),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_space_items_space_uuid").on(table.spaceUuid),
    index("idx_space_items_product_uuid").on(table.productUuid),
    index("idx_space_items_boq_uuid").on(table.boqUuid),
    // Replacement dates are read by asking "what is due", across every site, so
    // the install date is a filter and not just a displayed field.
    index("idx_space_items_installed_at").on(table.installedAt),
  ],
);

export type SelectSpaces = InferSelectModel<typeof Spaces>;
export type InsertSpaces = InferInsertModel<typeof Spaces>;
export type SelectSpaceItems = InferSelectModel<typeof SpaceItems>;
export type InsertSpaceItems = InferInsertModel<typeof SpaceItems>;
