import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { boqStatuses } from "../enum";

export const Boqs = mysqlTable(
  "Boqs",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    // The end user who created the BOQ.
    userUuid: char("user_uuid", { length: 36 }).notNull(),

    reference: varchar("reference", { length: 50 }).notNull(),
    status: mysqlEnum("status", boqStatuses).default("draft"),

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

export const BoqItems = mysqlTable(
  "BoqItems",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    boqUuid: char("boq_uuid", { length: 36 }).notNull(),
    productUuid: char("product_uuid", { length: 36 }).notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    categoryName: varchar("category_name", { length: 255 }),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).default("SAR"),
    quantity: int("quantity").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_boq_items_boq_uuid").on(table.boqUuid)],
);

export type SelectBoqs = InferSelectModel<typeof Boqs>;
export type InsertBoqs = InferInsertModel<typeof Boqs>;
export type SelectBoqItems = InferSelectModel<typeof BoqItems>;
export type InsertBoqItems = InferInsertModel<typeof BoqItems>;
