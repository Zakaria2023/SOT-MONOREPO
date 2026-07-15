import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";
import { BusinessLine } from "../enum";

export const Brands = mysqlTable(
  "Brands",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    parentUuid: char("parent_uuid", { length: 36 }).references(
      (): AnyMySqlColumn => Brands.uuid,
      { onDelete: "set null" },
    ),

    name: varchar("name", { length: 255 }).notNull(),
    // Brand-line code — the [BRAND-LINE] segment of the smart SKU (e.g. "HE").
    code: varchar("code", { length: 4 }),
    // What this brand calls its product code — e.g. "BOM" (Huawei), "PID"
    // (Cisco), "SKU", "Part Number" — used as the alias/ID column label.
    idLabel: varchar("id_label", { length: 100 }),
    // Internal note about the brand (enrollment details, contacts, quirks).
    note: text("note"),
    description: text("description"),
    order: int("order").default(0),

    // Business lines this brand sells into. Products inherit these from their
    // brand rather than carrying their own copy.
    businessLines: json("business_lines").$type<BusinessLine[]>(),

    image: varchar("image", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_brands_parent_uuid").on(table.parentUuid)],
);

export type SelectBrands = InferSelectModel<typeof Brands>;
export type InsertBrands = InferInsertModel<typeof Brands>;
