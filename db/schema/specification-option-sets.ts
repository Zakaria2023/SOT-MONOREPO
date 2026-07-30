import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  int,
  json,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { SpecOption } from "../types";

// A SHARED VOCABULARY — one list of option values, named once and pointed at
// from anywhere.
//
// WHY this table exists, and why it is not just another attribute:
//
// The boundary rule says a library entry may never name another attribute. That
// is what keeps a definition self-contained, and it is not up for negotiation.
// But it left one real problem with nowhere to go: a speed list authored inside
// the "Network Ports" group and a speed list on a standalone transceiver
// attribute were two separate lists. "1G" in one and "1G" in the other were
// different stored values that merely looked alike — so `cage speed >= module
// speed`, the whole point of modelling ports and optics, could not be asked.
//
// A set resolves that WITHOUT touching the boundary, because a set is not an
// attribute. It has no type, no unit, no condition, no rule, and no product ever
// holds a value "for" it. It is a dictionary. An attribute pointing at one is
// naming a vocabulary, not naming another attribute — nothing about attribute A
// reaches attribute B, they simply spell the same words the same way.
//
// The test that keeps it honest: if a field is ever added here that changes how
// an attribute BEHAVES, this has stopped being a dictionary and has become a
// second attribute table with different rules.
export const SpecificationOptionSets = mysqlTable("SpecificationOptionSets", {
  id: int("id").primaryKey().autoincrement(),
  // The only identity. Attributes and group sub-fields point at this, so
  // renaming a set is free.
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  // What an author picks it by — "Port Speed", "PoE Standard". Display only.
  name: varchar("name", { length: 255 }).notNull(),
  // What belongs in it and what does not, for the author who inherits it. A set
  // is shared, so the cost of somebody misunderstanding its scope is paid by
  // every attribute using it.
  description: varchar("description", { length: 500 }),

  // Whether this vocabulary is a SCALE (1G < 10G < 25G) rather than an unordered
  // set (Black | White).
  //
  // On the SET, never on the attribute pointing at it. Whether 1G is smaller
  // than 10G is a property of the words themselves, and two attributes sharing a
  // vocabulary must not be able to disagree about it — one saying "scale" and the
  // other "plain list" would make the same comparison work in one direction and
  // silently return nothing in the other.
  ordered: boolean("ordered").default(false).notNull(),

  // The list itself. Append-only with a `retired` flag, exactly as an
  // attribute's own master list is, and for a stronger reason: a value here may
  // be held by products across several attributes at once, so deleting one
  // orphans more than a single column.
  options: json("options").$type<SpecOption[]>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectSpecificationOptionSets = InferSelectModel<
  typeof SpecificationOptionSets
>;
export type InsertSpecificationOptionSets = InferInsertModel<
  typeof SpecificationOptionSets
>;
