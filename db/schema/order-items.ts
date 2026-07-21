import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  decimal,
  index,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { Orders } from "./orders";
import { Products } from "./products";

// Line items for a direct (non-BOQ) product order. Name and unit price are
// snapshotted at order time — the discounted unit price the customer paid — so
// the order is stable even if the product changes or is deleted later.
export const OrderItems = mysqlTable(
  "OrderItems",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    orderUuid: char("order_uuid", { length: 36 })
      .notNull()
      .references(() => Orders.uuid, { onDelete: "cascade" }),
    // Kept for reference; nulled if the product is later removed.
    productUuid: char("product_uuid", { length: 36 }).references(
      () => Products.uuid,
      { onDelete: "set null" },
    ),

    name: varchar("name", { length: 255 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    quantity: int("quantity").notNull(),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_order_items_order_uuid").on(table.orderUuid)],
);

export type SelectOrderItems = InferSelectModel<typeof OrderItems>;
export type InsertOrderItems = InferInsertModel<typeof OrderItems>;
