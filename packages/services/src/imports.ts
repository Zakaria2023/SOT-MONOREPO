import { and, eq, inArray, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import {
  ImportBatches,
  ImportIssues,
  ImportRows,
  type ImportPayload,
  type ImportProposal,
  type SelectImportIssues,
  type SelectImportRows,
} from "../../../db/schema/imports";
import { Specifications } from "../../../db/schema/specifications";
import type { SpecOption } from "../../../db/types";
import { ConflictError, ValidationError } from "./errors";
import {
  applyResolutions,
  type DraftIssue,
  type ParsedRow,
  type SourceRow,
} from "./import-pipeline";
import { createProduct, updateProduct } from "./products";
import { addOptionToAttribute } from "./specification-library";

// THE COMMIT PATH — how an answered queue becomes products.
//
// The gate this file exists to hold: A ROW WITH AN OPEN ISSUE CANNOT COMMIT.
// Everything else here is bookkeeping around that one sentence.
//
// It writes products only through createProduct/updateProduct, never with its
// own insert. That is what keeps SKU generation, slug uniqueness, value
// normalisation and the brand+model+variant check identical whether a product
// was typed by a clerk or arrived in a batch of 290 — a second write path is how
// an import ends up with products the manual route would have refused.

// ---------------------------------------------------------------------------

export type StagedRow = {
  rowUuid: string;
  issueCount: number;
};

/** One question, and every row waiting on it. */
export type IssueGroup = {
  groupKey: string;
  type: SelectImportIssues["type"];
  specificationUuid: string | null;
  attributeLabel: string | null;
  sourceText: string | null;
  proposedValue: ImportProposal | null;
  // Why the group exists: answering once clears this many rows.
  affectedRows: number;
};

// ---------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------

export const createImportBatch = async (source: string): Promise<string> => {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new ValidationError("An import batch needs a source to be named by.");
  }
  const uuid = generateUuid();
  await db.insert(ImportBatches).values({ uuid, source: trimmed });
  return uuid;
};

/**
 * Park one parsed product and its questions.
 *
 * Keyed on `sourceRef`, so a second run over the same source updates the row it
 * already made instead of stacking a duplicate beside it. Re-staging clears the
 * previous issues rather than merging: they were the OLD parse's questions, and
 * leaving them would block a row on an objection that no longer applies.
 */
export const stageImportRow = async (input: {
  batchUuid: string;
  row: SourceRow;
  parsed: ParsedRow;
  categoryUuid?: string | null;
  brandUuid?: string | null;
  sourceText?: string | null;
}): Promise<StagedRow> => {
  const { batchUuid, row, parsed } = input;

  return db.transaction(async (tx) => {
    const payload: ImportPayload = {
      name: parsed.name,
      model: parsed.model,
      brandUuid: input.brandUuid ?? undefined,
      specValues: parsed.specValues,
    };

    const [existing] = await tx
      .select({ uuid: ImportRows.uuid })
      .from(ImportRows)
      .where(
        and(
          eq(ImportRows.batchUuid, batchUuid),
          eq(ImportRows.sourceRef, row.sourceRef),
        ),
      )
      .limit(1);

    const rowUuid = existing?.uuid ?? generateUuid();
    if (existing) {
      await tx
        .update(ImportRows)
        .set({
          payload,
          categoryUuid: input.categoryUuid ?? null,
          sourceText: input.sourceText ?? null,
          status: "pending",
        })
        .where(eq(ImportRows.uuid, rowUuid));
      await tx.delete(ImportIssues).where(eq(ImportIssues.rowUuid, rowUuid));
    } else {
      await tx.insert(ImportRows).values({
        uuid: rowUuid,
        batchUuid,
        sourceRef: row.sourceRef,
        sourceText: input.sourceText ?? null,
        categoryUuid: input.categoryUuid ?? null,
        payload,
      });
    }

    if (parsed.issues.length > 0) {
      await tx.insert(ImportIssues).values(
        parsed.issues.map((issue: DraftIssue) => ({
          uuid: generateUuid(),
          rowUuid,
          type: issue.type,
          groupKey: issue.groupKey,
          specificationUuid: issue.specificationUuid ?? null,
          sourceText: issue.sourceText,
          proposedValue: issue.proposedValue ?? null,
        })),
      );
    }

    return { rowUuid, issueCount: parsed.issues.length };
  });
};

// ---------------------------------------------------------------------------
// Reviewing
// ---------------------------------------------------------------------------

/**
 * The queue as A6 renders it: one entry per QUESTION, not per occurrence.
 *
 * `||` on 68 products is one row here with `affectedRows: 68`. Listing it 68
 * times is not a longer list, it is a reviewer who starts clicking through —
 * and a queue clicked through has failed at the only job it has.
 */
export const getOpenIssueGroups = async (
  batchUuid: string,
): Promise<IssueGroup[]> => {
  const rows = await db
    .select({
      groupKey: ImportIssues.groupKey,
      type: ImportIssues.type,
      specificationUuid: ImportIssues.specificationUuid,
      attributeLabel: Specifications.label,
      sourceText: sql<string | null>`MIN(${ImportIssues.sourceText})`,
      proposedValue: sql<ImportProposal | null>`MIN(${ImportIssues.proposedValue})`,
      affectedRows: sql<number>`COUNT(DISTINCT ${ImportIssues.rowUuid})`,
    })
    .from(ImportIssues)
    .innerJoin(ImportRows, eq(ImportRows.uuid, ImportIssues.rowUuid))
    .leftJoin(
      Specifications,
      eq(Specifications.uuid, ImportIssues.specificationUuid),
    )
    .where(
      and(
        eq(ImportRows.batchUuid, batchUuid),
        eq(ImportIssues.status, "open"),
      ),
    )
    .groupBy(
      ImportIssues.groupKey,
      ImportIssues.type,
      ImportIssues.specificationUuid,
      Specifications.label,
    )
    .orderBy(sql`COUNT(DISTINCT ${ImportIssues.rowUuid}) DESC`);

  return rows.map((row) => ({
    ...row,
    affectedRows: Number(row.affectedRows),
  }));
};

/**
 * Answer one question everywhere it was asked.
 *
 * The whole reason `groupKey` exists. One write settles every open issue that
 * asked the same thing, and the reviewer's name goes on all of them.
 *
 * An option must be on the master list before it can be an answer. A reviewer
 * who has met a genuinely new value passes `addOption` and it is added first —
 * through the library's own guards, never by pushing onto an array — so the
 * call that answers the question is the call that made the answer valid.
 *
 * Without that flag an unrecognised value is refused and named. The distinction
 * is the "controlled" in controlled-add: a new word enters the vocabulary
 * because somebody said so, not as a side effect of clearing a queue.
 */
export const resolveIssueGroup = async (input: {
  batchUuid: string;
  groupKey: string;
  status: "approved" | "corrected" | "rejected";
  resolution?: ImportProposal;
  // Controlled-add, and the word "controlled" is the whole point: a new option
  // enters the master list only because a reviewer said so, explicitly, on this
  // call. Absent, an unrecognised value is refused and named. It is never a
  // side effect of answering a question.
  addOption?: { label: string; aliases?: string[] };
  decidedBy?: string;
}): Promise<number> => {
  const { batchUuid, groupKey, status, resolution } = input;

  if (status === "corrected" && !resolution) {
    throw new ValidationError(
      "A corrected issue needs the value it is being corrected to.",
    );
  }

  const targets = await db
    .select({
      uuid: ImportIssues.uuid,
      specificationUuid: ImportIssues.specificationUuid,
      proposedValue: ImportIssues.proposedValue,
    })
    .from(ImportIssues)
    .innerJoin(ImportRows, eq(ImportRows.uuid, ImportIssues.rowUuid))
    .where(
      and(
        eq(ImportRows.batchUuid, batchUuid),
        eq(ImportIssues.groupKey, groupKey),
        eq(ImportIssues.status, "open"),
      ),
    );

  if (targets.length === 0) {
    throw new ConflictError(
      "Nothing open is waiting on that answer — somebody may have resolved it already.",
    );
  }

  let answer =
    status === "rejected" ? null : (resolution ?? targets[0]?.proposedValue ?? null);
  const specUuid = answer?.specificationUuid ?? targets[0]?.specificationUuid ?? null;

  // Adding the value comes FIRST, so the same call that answers the question is
  // the one that made the answer valid. Adding it afterwards would leave a
  // window where the issues are resolved and point at a value the library does
  // not have — and a failure between the two would be exactly that state, on
  // disk, with nothing saying why the rows will not commit.
  if (input.addOption && status !== "rejected") {
    if (!specUuid) {
      throw new ValidationError(
        "That question is not about one attribute, so there is no master list to add to.",
      );
    }
    const value = await addOptionToAttribute(specUuid, input.addOption);
    answer = { ...(answer ?? {}), option: value };
  }

  if (answer?.option && specUuid) {
    await assertOptionExists(specUuid, answer.option);
  }

  await db
    .update(ImportIssues)
    .set({
      status,
      resolvedValue: answer,
      decidedBy: input.decidedBy ?? null,
      decidedAt: new Date(),
    })
    .where(
      inArray(
        ImportIssues.uuid,
        targets.map((target) => target.uuid),
      ),
    );

  return targets.length;
};

const assertOptionExists = async (
  specificationUuid: string,
  value: string,
): Promise<void> => {
  const [attribute] = await db
    .select({ label: Specifications.label, options: Specifications.options })
    .from(Specifications)
    .where(eq(Specifications.uuid, specificationUuid))
    .limit(1);

  if (!attribute) {
    throw new ValidationError("That attribute no longer exists in the library.");
  }
  const options: SpecOption[] = attribute.options ?? [];
  if (!options.some((option) => option.value === value)) {
    throw new ValidationError(
      `"${value}" is not on ${attribute.label}'s master list. Add it in the Library first — a value invented here would fork the list for every product that already holds one.`,
    );
  }
};

// ---------------------------------------------------------------------------
// Committing
// ---------------------------------------------------------------------------

/**
 * Turn one reviewed row into a product.
 *
 * Refuses while anything is open. That refusal is the queue — without it the
 * three tables are an audit log of decisions nobody had to make.
 */
export const commitImportRow = async (rowUuid: string): Promise<string> => {
  const [row] = await db
    .select()
    .from(ImportRows)
    .where(eq(ImportRows.uuid, rowUuid))
    .limit(1);

  if (!row) {
    throw new ValidationError("That import row no longer exists.");
  }
  if (row.status === "rejected") {
    throw new ConflictError("That row was rejected and cannot be committed.");
  }

  const issues = await db
    .select()
    .from(ImportIssues)
    .where(eq(ImportIssues.rowUuid, rowUuid));

  const open = issues.filter((issue) => issue.status === "open");
  if (open.length > 0) {
    throw new ConflictError(
      `${open.length} question${open.length === 1 ? "" : "s"} on this row ${open.length === 1 ? "is" : "are"} still unanswered.`,
    );
  }

  const payload = row.payload;
  if (!payload?.name || !payload.brandUuid || !row.categoryUuid) {
    throw new ValidationError(
      "A row needs a name, a brand and a category before it can become a product.",
    );
  }

  const fields = {
    name: payload.name,
    model: payload.model ?? null,
    brandUuid: payload.brandUuid,
    categoryUuid: row.categoryUuid,
    seriesCode: payload.seriesCode ?? null,
    variantUuids: payload.variantUuids ?? [],
    specValues: applyResolutions(payload, issues),
  } as Parameters<typeof createProduct>[0];

  // An earlier commit of the same source already made this product, so this is
  // the same thing arriving again — updated, never duplicated.
  const productUuid = row.productUuid ?? undefined;
  if (productUuid) {
    await updateProduct(productUuid, fields);
  }
  const uuid = productUuid ?? (await createProduct(fields));

  await db
    .update(ImportRows)
    .set({ status: "committed", productUuid: uuid })
    .where(eq(ImportRows.uuid, rowUuid));

  return uuid;
};

export type CommitReport = {
  committed: string[];
  blocked: { rowUuid: string; reason: string }[];
};

/**
 * Commit everything that is ready and report what is not.
 *
 * Rows go one at a time, deliberately. A single transaction over 290 products
 * means one unresolvable row discards 289 good ones, and a run that has to be
 * repeated from the start is a run nobody finishes.
 */
export const commitImportBatch = async (
  batchUuid: string,
): Promise<CommitReport> => {
  const rows = await db
    .select({ uuid: ImportRows.uuid })
    .from(ImportRows)
    .where(
      and(eq(ImportRows.batchUuid, batchUuid), eq(ImportRows.status, "pending")),
    );

  const report: CommitReport = { committed: [], blocked: [] };
  for (const row of rows) {
    try {
      report.committed.push(await commitImportRow(row.uuid));
    } catch (error) {
      report.blocked.push({
        rowUuid: row.uuid,
        reason: error instanceof Error ? error.message : "Unknown failure",
      });
    }
  }

  // The batch closes only when nothing is left waiting. A partially committed
  // batch stays in review so the rows that did not make it remain visible.
  if (report.blocked.length === 0) {
    await db
      .update(ImportBatches)
      .set({ status: "committed" })
      .where(eq(ImportBatches.uuid, batchUuid));
  }

  return report;
};

export type { SelectImportRows };
