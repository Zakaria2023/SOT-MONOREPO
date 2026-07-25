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

    assignedPreSellerId: varchar("assigned_pre_seller_id", { length: 64 }),
    assignedPreSellerName: varchar("assigned_pre_seller_name", { length: 255 }),

    // This design's answers to the project variables (ProjectVariables.key →
    // the entered number, as a string so it round-trips like every other spec
    // value). A key with no answer falls back to the variable's default, so a
    // rule reading it still has a number rather than quietly not applying.
    variableValues: json("variable_values").$type<Record<string, string>>(),

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
