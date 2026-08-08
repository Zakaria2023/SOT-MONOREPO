import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { boqItemRoles, boqLineTypes, boqStatuses } from "../enum";
import type { ProjectAnswers } from "../types";
import { Products } from "./products";
import { Users } from "./users";

export const Boqs = mysqlTable(
  "Boqs",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    // The end user who created the BOQ.
    userUuid: char("user_uuid", { length: 36 })
      .notNull()
      .references(() => Users.uuid, { onDelete: "restrict" }),

    reference: varchar("reference", { length: 50 }).notNull(),
    status: mysqlEnum("status", boqStatuses).default("draft"),

    // The physical place this solution is for, and how the BOQ was built.
    site: varchar("site", { length: 255 }),
    source: varchar("source", { length: 30 }).default("self_selected"),

    // The Space this design is FOR, when it is an addition to a site that already
    // has equipment in it rather than a new installation.
    //
    // Set makes the difference between "design me a system" and "add four cameras
    // to the one I have", and those are not the same question: the second has to
    // be judged against what is already on the wall, because the switch that will
    // power the new cameras is already half full.
    //
    // `site` above stays. It is free text somebody typed while shopping, and it
    // exists before any Space does — a customer describes where the job is long
    // before there is a register of what is installed there.
    //
    // No foreign key, and this is the one place in the schema that goes without
    // one. `spaces.ts` imports `Boqs` to constrain a SpaceItem to the job that
    // installed it, so declaring the reverse reference here would make the two
    // modules import each other. Of the two constraints the item-to-job one is
    // worth more: it is the provenance of a physical device, whereas this is a
    // pointer from a document to a place. Enforced in the service instead, which
    // is where the ownership check that has to happen anyway already lives — a
    // customer must not attach their BOQ to somebody else's building, and no
    // foreign key could have said that.
    spaceUuid: char("space_uuid", { length: 36 }),

    // The buyer's answers to the project questions the design check asked in
    // the cart, carried so the pre-seller's validation judges the same design
    // the buyer saw. Null for a BOQ whose rules asked nothing.
    projectInputs: json("project_inputs").$type<ProjectAnswers>(),

    assignedPreSellerId: varchar("assigned_pre_seller_id", { length: 64 }),
    assignedPreSellerName: varchar("assigned_pre_seller_name", { length: 255 }),

    submittedAt: timestamp("submitted_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_boqs_user_uuid").on(table.userUuid),
    index("idx_boqs_status").on(table.status),
    index("idx_boqs_assigned_pre_seller_id").on(table.assignedPreSellerId),
  ],
);

// A BOQ is organised into sections, one per system (CCTV, Alarm, Network, IP
// Telephony …). Each section is the unit a subtotal is read against and the
// unit milestone billing releases payment against.
export const BoqSections = mysqlTable(
  "BoqSections",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    boqUuid: char("boq_uuid", { length: 36 })
      .notNull()
      .references(() => Boqs.uuid, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    order: int("order").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_boq_sections_boq_uuid").on(table.boqUuid)],
);

export const BoqItems = mysqlTable(
  "BoqItems",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    boqUuid: char("boq_uuid", { length: 36 })
      .notNull()
      .references(() => Boqs.uuid, { onDelete: "cascade" }),
    // Which system this line sits in. Null lines are treated as one implicit
    // section for older BOQs created before sections existed.
    sectionUuid: char("section_uuid", { length: 36 }).references(
      () => BoqSections.uuid,
      { onDelete: "set null" },
    ),
    // Product lines link to the catalog; service (labour) lines do not, so this
    // is nullable.
    productUuid: char("product_uuid", { length: 36 }).references(
      () => Products.uuid,
      { onDelete: "restrict" },
    ),

    // The two streams that make this a BOQ and not a BOM.
    lineType: mysqlEnum("line_type", boqLineTypes).default("product").notNull(),
    // Place in the system — drives completeness validation. Null for service.
    role: mysqlEnum("role", boqItemRoles),

    name: varchar("name", { length: 255 }).notNull(),
    categoryName: varchar("category_name", { length: 255 }),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).default("SAR"),
    quantity: int("quantity").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_boq_items_boq_uuid").on(table.boqUuid),
    index("idx_boq_items_section_uuid").on(table.sectionUuid),
    index("idx_boq_items_product_uuid").on(table.productUuid),
  ],
);

export type SelectBoqs = InferSelectModel<typeof Boqs>;
export type InsertBoqs = InferInsertModel<typeof Boqs>;
export type SelectBoqSections = InferSelectModel<typeof BoqSections>;
export type InsertBoqSections = InferInsertModel<typeof BoqSections>;
export type SelectBoqItems = InferSelectModel<typeof BoqItems>;
export type InsertBoqItems = InferInsertModel<typeof BoqItems>;
