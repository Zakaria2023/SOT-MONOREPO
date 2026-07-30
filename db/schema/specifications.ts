import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  char,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { assignmentAudiences, specificationTypes } from "../enum";
import { SpecGroupField, SpecOption } from "../types";
import { SpecificationGroups } from "./specification-groups";
import { SpecificationOptionSets } from "./specification-option-sets";

// THE LIBRARY — where an attribute is born, exactly once.
//
// "Port Speed" is authored one time; every category that uses it points at THIS
// row, which is what makes 1G on a switch and 1G on a NAS provably the same
// value and lets a rule compare across categories that know nothing about each
// other.
//
// A row here describes ONLY itself. It carries no condition, no category, no
// reference to another attribute — the boundary rule. The moment a definition
// can say "show me when PoE = Yes" it has become an assignment, and we are back
// to the same conditional logic living in two places with no single truth.
export const Specifications = mysqlTable("Specifications", {
  id: int("id").primaryKey().autoincrement(),
  // The ONLY identity. Products store values under it, assignments point at it,
  // relationships reference it, predicates name it. Never derived from the
  // label, so renaming an attribute cannot orphan a single stored value.
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  // Master-library group (Power, Connectivity, ...) — filing only. A group that
  // changed behaviour would be a second, weaker category tree.
  groupUuid: char("group_uuid", { length: 36 }).references(
    () => SpecificationGroups.uuid,
    { onDelete: "set null" },
  ),

  // Display text. Deliberately NOT unique: "Type" is rack height on a rack,
  // cable grade on a cable and switch role on a switch. The shopper should see
  // "Type" in all three places while the engine keeps them apart by uuid.
  label: varchar("label", { length: 255 }).notNull(),
  // How authors tell two same-labelled attributes apart in the admin. Never
  // shown to a shopper, never used for identity.
  internalName: varchar("internal_name", { length: 255 }),
  // A human-readable slug for exports and the AI read model ONLY. Nothing
  // points at it, so it is free to change when the label does.
  key: varchar("key", { length: 255 }).notNull(),

  description: varchar("description", { length: 500 }),

  // One stored type — number / single_select / multi_select / boolean. Not a
  // UX type plus an engine type derived from it: two stored fields for one fact
  // can disagree in the database, and then nothing knows which is true.
  type: mysqlEnum("type", specificationTypes).notNull(),

  // Only meaningful for `number`. A rule may only compare two operands whose
  // units share a dimension (see UNIT_DIMENSIONS) — otherwise W and kW sum
  // together with no error and the check approves a 1000x overload.
  unit: varchar("unit", { length: 32 }),

  // Whether `options` is a SCALE (802.3af < at < bt; 1G < 10G) rather than an
  // unordered set (Black | White). Two behaviours read it: the lte/gte
  // comparators, which compare an option's `rank`; and the "up to" quick-pick
  // when an author is choosing a category's enabled slice.
  //
  // Definition-level, never per-category — whether a list is a scale is a
  // property of the attribute itself, not of where it is used.
  //
  // IGNORED when `optionSetUuid` is set: a shared vocabulary carries its own
  // `ordered`, because whether 1G is smaller than 10G belongs to the words and
  // not to whoever borrowed them. Two attributes sharing a list must not be able
  // to disagree about that.
  ordered: boolean("ordered").default(false).notNull(),

  // Only meaningful for `number`. Whether a product answers this with a SPAN
  // (−20 to 60 °C) rather than a single figure.
  //
  // Definition-level for the same reason `ordered` is: whether a quantity is
  // naturally a range is a property of the quantity, not of the category asking
  // for it. Operating temperature is a range on a switch and on a camera.
  //
  // A plain number is the degenerate range where min equals max, so turning this
  // on never invalidates the values already stored.
  allowRange: boolean("allow_range").default(false).notNull(),

  // The MASTER option list. Categories narrow which of these they offer (see
  // SpecificationCategories.enabledValues) but never edit this list — a
  // per-category edit would fork the attribute and break every rule comparing
  // across categories. Options are append-only; removal is the `retired` flag,
  // so a product holding a value never ends up holding one that no longer
  // exists.
  //
  // EMPTY when `optionSetUuid` is set: the two are never both populated, because
  // two lists for one attribute is two answers to "what may a product hold" and
  // nothing would know which is true.
  options: json("options").$type<SpecOption[]>(),

  // Points at a SHARED vocabulary instead of owning a list (see
  // SpecificationOptionSets). Null is the normal case — an attribute nobody
  // needs to compare against keeps its list to itself.
  //
  // This is what makes "cage speed >= module speed" askable: two attributes
  // pointing here spell 1G identically, so their stored values are comparable.
  // Not a boundary-rule violation — a set is a dictionary, not an attribute.
  //
  // Changing it is REFUSED once any product holds a value for the attribute (see
  // specification-library): re-pointing reinterprets every stored value at once,
  // silently, which is the exact class of failure this model exists to stop.
  optionSetUuid: char("option_set_uuid", { length: 36 }).references(
    () => SpecificationOptionSets.uuid,
    // Deliberately NOT a cascade. Deleting a set that attributes still use would
    // leave them with no vocabulary and every product value unreadable, so the
    // service refuses the delete instead and names what is in the way.
    { onDelete: "restrict" },
  ),

  // Only meaningful for `group`. The sub-fields one authored row carries, in
  // column order — {count, family, max speed} for network ports, {outlet type,
  // count} for outlets.
  //
  // Definition-level, like `options` and for the same reason: the shape of a port
  // group is a property of "Network Ports" itself. A per-category shape would fork
  // the attribute, and two categories storing differently-shaped rows under one
  // uuid is a value nothing can read back.
  groupFields: json("group_fields").$type<SpecGroupField[]>(),

  // Who this attribute is FOR. Set once, where it is born: an installer
  // certification is a partner concern wherever it is used, not something every
  // category has to remember. A category may NARROW this on its assignment but
  // never widen it, so marking an attribute staff-only here cannot be undone by
  // one category exposing it publicly by mistake.
  audience: mysqlEnum("audience", assignmentAudiences)
    .default("everyone")
    .notNull(),

  order: int("order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SelectSpecifications = InferSelectModel<typeof Specifications>;
export type InsertSpecifications = InferInsertModel<typeof Specifications>;
