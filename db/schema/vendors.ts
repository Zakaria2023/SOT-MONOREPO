import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  mysqlEnum,
  mysqlTable,
  int,
  text,
  timestamp,
  varchar,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";
import { vendorStatuses } from "../enum";

export const Vendors = mysqlTable(
  "Vendors",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    parentUuid: char("parent_uuid", { length: 36 }).references(
      (): AnyMySqlColumn => Vendors.uuid,
      { onDelete: "set null" },
    ),

    name: varchar("name", { length: 255 }).notNull(),
    // What this vendor calls its product code — e.g. "BOM" (Huawei), "PID"
    // (Cisco), "SKU", "Part Number" — used as the alias table's column label.
    idLabel: varchar("id_label", { length: 100 }).notNull(),
    status: mysqlEnum("status", vendorStatuses).default("active").notNull(),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_vendors_parent_uuid").on(table.parentUuid),
    index("idx_vendors_status").on(table.status),
  ],
);

export type SelectVendors = InferSelectModel<typeof Vendors>;
export type InsertVendors = InferInsertModel<typeof Vendors>;
