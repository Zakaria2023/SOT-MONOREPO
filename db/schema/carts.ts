import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  mysqlTable,
  timestamp,
  unique,
} from "drizzle-orm/mysql-core";
import { Products } from "./products";
import { Users } from "./users";

export const Carts = mysqlTable("Carts", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  userUuid: char("user_uuid", { length: 36 })
    .notNull()
    .unique()
    .references(() => Users.uuid, { onDelete: "cascade" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const CartItems = mysqlTable(
  "CartItems",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    cartUuid: char("cart_uuid", { length: 36 })
      .notNull()
      .references(() => Carts.uuid, { onDelete: "cascade" }),
    productUuid: char("product_uuid", { length: 36 })
      .notNull()
      .references(() => Products.uuid, { onDelete: "cascade" }),

    quantity: int("quantity").default(1).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_cart_items_cart_uuid").on(table.cartUuid),
    index("idx_cart_items_product_uuid").on(table.productUuid),
    // A product appears at most once per cart — adding again bumps the quantity.
    unique("uq_cart_items_cart_product").on(table.cartUuid, table.productUuid),
  ],
);

export type SelectCarts = InferSelectModel<typeof Carts>;
export type InsertCarts = InferInsertModel<typeof Carts>;
export type SelectCartItems = InferSelectModel<typeof CartItems>;
export type InsertCartItems = InferInsertModel<typeof CartItems>;
