import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  importBatchStatuses,
  importIssueStatuses,
  importIssueTypes,
  importRowStatuses,
} from "../enum";
import { ProductValues } from "../types";
import { Categories } from "./categories";
import { Products } from "./products";
import { Specifications } from "./specifications";

// THE HOLDING AREA — where an import waits for a human.
//
// The importer's definition of done is "a review queue, not a populated
// catalogue". These three tables are that queue, and the reason they exist as
// tables rather than as a step inside a script is that a DECISION has to
// survive: 68 products say `||` where the master list says `II`, and somebody
// has to answer that once, on the record, before any of the 68 land.
//
// Nothing here writes to the catalogue. A row becomes a product by being handed
// to createProduct, which is what keeps SKU generation, value normalisation and
// the brand+model+variant uniqueness check in one place no matter whether the
// product arrived by hand or by import.

// ---------------------------------------------------------------------------

// ONE IMPORT RUN.
export const ImportBatches = mysqlTable("ImportBatches", {
  id: int("id").primaryKey().autoincrement(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),

  // Where the rows came from, in a human's words — "Ajax spec pages 2026-08-08".
  // Free text on purpose: the next source is a vendor nobody has named yet, and
  // an enum here would need widening before anyone could import anything.
  source: varchar("source", { length: 255 }).notNull(),

  status: mysqlEnum("status", importBatchStatuses).default("parsing").notNull(),

  // What the parse itself could not do — a file that would not open, a page
  // shape the extractor did not recognise. Distinct from an issue, which is
  // about ONE value and is answerable; this is about the run.
  note: text("note"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// ---------------------------------------------------------------------------

// ONE SOURCE PRODUCT, parsed as far as it could be.
export const ImportRows = mysqlTable(
  "ImportRows",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    batchUuid: char("batch_uuid", { length: 36 }).notNull(),

    // The vendor's own handle for this thing — a URL, a page id, a row number.
    // Kept so a second run recognises what it already saw. NOT the slug: brands
    // reuse one slug across a whole variant family, and 86 of Ajax's 290 share
    // one with a sibling, so a slug-keyed import silently overwrites.
    sourceRef: varchar("source_ref", { length: 500 }).notNull(),

    // The raw text this row was read from, kept verbatim.
    //
    // A6 has to show the source BESIDE the proposed interpretation, because the
    // question a reviewer is actually answering is "did the parser read this
    // right" — and that is unanswerable without the original. It also survives
    // the parser being fixed: a re-parse can run against stored text rather than
    // against a vendor site whose markup has since changed.
    sourceText: text("source_text"),

    // Where the importer thinks this belongs, once resolved. Nullable because a
    // row whose category could not be resolved is exactly the kind of thing the
    // queue is for.
    categoryUuid: char("category_uuid", { length: 36 }),

    // The parsed product, in the shape createProduct takes: name, model, brand,
    // variants, spec values. JSON rather than columns because this is a DRAFT of
    // a product and not a product — giving it real columns would make it a
    // second, weaker Products table that slowly drifts from the first.
    payload: json("payload").$type<ImportPayload | null>(),

    status: mysqlEnum("status", importRowStatuses).default("pending").notNull(),

    // Set when the row commits. Present means "this became that product", which
    // is what makes a re-import an update instead of a duplicate.
    productUuid: char("product_uuid", { length: 36 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_import_rows_batch").on(table.batchUuid),
    index("idx_import_rows_status").on(table.status),
    index("idx_import_rows_source_ref").on(table.sourceRef),
    foreignKey({
      name: "fk_import_rows_batch",
      columns: [table.batchUuid],
      foreignColumns: [ImportBatches.uuid],
      // The batch is the run; its rows are only meaningful inside it.
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_import_rows_category",
      columns: [table.categoryUuid],
      foreignColumns: [Categories.uuid],
    }).onDelete("set null"),
    foreignKey({
      name: "fk_import_rows_product",
      columns: [table.productUuid],
      foreignColumns: [Products.uuid],
      // Deleting a product must not delete the record that it was imported.
    }).onDelete("set null"),
  ],
);

// ---------------------------------------------------------------------------

// ONE THING THE IMPORTER WOULD NOT DECIDE ON ITS OWN.
export const ImportIssues = mysqlTable(
  "ImportIssues",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    rowUuid: char("row_uuid", { length: 36 }).notNull(),

    type: mysqlEnum("type", importIssueTypes).notNull(),
    status: mysqlEnum("status", importIssueStatuses).default("open").notNull(),

    // Which attribute this is about. Null for a row-level issue — a category
    // that would not resolve, or a page holding several products.
    specificationUuid: char("specification_uuid", { length: 36 }),

    // WHAT MAKES ONE DECISION RESOLVE 68 PRODUCTS.
    //
    // Identical issues carry an identical key — `unknown_value` on the same
    // attribute with the same source text is one question, not 68. A6 groups on
    // it, and answering the group writes the same resolution to every member.
    //
    // Without this the reviewer answers `||` sixty-eight times, and the realistic
    // outcome is not sixty-eight careful answers: it is a reviewer who starts
    // clicking through, which is the queue failing at the one job it has.
    groupKey: varchar("group_key", { length: 255 }).notNull(),

    // The source text this issue is about, exactly as written.
    sourceText: text("source_text"),

    // What the importer would do if allowed. Shown next to the source so the
    // reviewer is confirming a reading rather than inventing one — and it is a
    // PROPOSAL: nothing here reaches a product until somebody approves it.
    proposedValue: json("proposed_value").$type<ImportProposal | null>(),

    // What the human settled on. Null while open, and null on a `rejected`
    // issue too — rejecting means the field stays empty, which is a real answer.
    // Empty is empty: never zero, never "N/A".
    resolvedValue: json("resolved_value").$type<ImportProposal | null>(),

    // Who answered, and when. Required by A15 and by SABER/ZATCA regardless, and
    // retrofitting it later is the part that never gets done properly.
    decidedBy: char("decided_by", { length: 36 }),
    decidedAt: timestamp("decided_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_import_issues_row").on(table.rowUuid),
    index("idx_import_issues_status").on(table.status),
    // The grouped view is the primary way this table is read.
    index("idx_import_issues_group").on(table.groupKey, table.status),
    foreignKey({
      name: "fk_import_issues_row",
      columns: [table.rowUuid],
      foreignColumns: [ImportRows.uuid],
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_import_issues_spec",
      columns: [table.specificationUuid],
      foreignColumns: [Specifications.uuid],
      // An attribute a rule still references cannot be deleted anyway; if one
      // ever is, the issue survives as a record of what was asked.
    }).onDelete("set null"),
  ],
);

/** A draft product, in the shape the commit step hands to createProduct. */
export type ImportPayload = {
  name?: string;
  model?: string;
  brandUuid?: string;
  seriesCode?: string;
  variantUuids?: string[];
  specValues?: ProductValues;
};

/** One proposed or settled answer to an issue. */
export type ImportProposal = {
  // The attribute value being proposed, already coerced to its declared type.
  value?: ProductValues[string];
  // For unknown_value: the canonical option this maps onto, or the new option
  // being added under controlled-add.
  option?: string;
  // For unknown_attribute: which attribute the source label resolves to.
  specificationUuid?: string;
  // For multi_variant: the variant set this row should carry.
  variantUuids?: string[];
  // Why, in the reviewer's words. Worth keeping — the next person to meet the
  // same source text is reading this to decide whether the precedent applies.
  note?: string;
};

export type SelectImportBatches = InferSelectModel<typeof ImportBatches>;
export type InsertImportBatches = InferInsertModel<typeof ImportBatches>;
export type SelectImportRows = InferSelectModel<typeof ImportRows>;
export type InsertImportRows = InferInsertModel<typeof ImportRows>;
export type SelectImportIssues = InferSelectModel<typeof ImportIssues>;
export type InsertImportIssues = InferInsertModel<typeof ImportIssues>;
