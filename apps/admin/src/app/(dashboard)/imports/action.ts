"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  commitImportBatch,
  commitImportRow,
  createImportBatch,
  importTargetsForCategory,
  parsePastedSource,
  parseSourceRow,
  resolveIssueGroup,
  stageImportRow,
  type ImportTarget,
} from "services";
import { ActionResult, fail } from "utils";

export type ImportActionResult = ActionResult & { batchUuid?: string };

/**
 * Read a pasted block into a batch of questions.
 *
 * The parse runs HERE and the catalogue is not touched: every product lands in
 * the queue as a draft, and nothing becomes a product until somebody has
 * answered what the parser would not decide. That is the whole point of the
 * screen this feeds.
 */
export const createBatchFromPaste = async (
  _prevState: ImportActionResult,
  fields: {
    source: string;
    categoryUuid: string;
    brandUuid: string;
    text: string;
  },
): Promise<ImportActionResult> => {
  await requireAdmin();

  let batchUuid: string;
  try {
    const rows = parsePastedSource(fields.text);
    if (rows.length === 0) {
      return { error: "No products could be read out of that text." };
    }

    // The category decides which attributes exist and which values each offers,
    // so it is resolved once for the batch rather than per row.
    const targets: ImportTarget[] = await importTargetsForCategory(
      fields.categoryUuid,
    );

    batchUuid = await createImportBatch(fields.source);
    for (const row of rows) {
      await stageImportRow({
        batchUuid,
        row,
        parsed: parseSourceRow(row, targets),
        categoryUuid: fields.categoryUuid,
        brandUuid: fields.brandUuid,
        sourceText: row.fields
          .map((field) => `${field.label}: ${field.text}`)
          .join("\n"),
      });
    }
  } catch (error) {
    return fail(error, "Failed to read that source");
  }

  revalidatePath("/imports");
  redirect(`/imports/${batchUuid}`);
};

export const answerIssueGroup = async (
  batchUuid: string,
  _prevState: ActionResult,
  fields: {
    groupKey: string;
    status: "approved" | "corrected" | "rejected";
    option?: string;
    newOptionLabel?: string;
  },
): Promise<ActionResult> => {
  const admin = await requireAdmin();
  try {
    await resolveIssueGroup({
      batchUuid,
      groupKey: fields.groupKey,
      status: fields.status,
      resolution: fields.option ? { option: fields.option } : undefined,
      addOption: fields.newOptionLabel
        ? { label: fields.newOptionLabel }
        : undefined,
      decidedBy: admin.actor.uuid,
    });
  } catch (error) {
    return fail(error, "Failed to answer that question");
  }

  revalidatePath(`/imports/${batchUuid}`);
  return { success: true };
};

export const commitRow = async (
  batchUuid: string,
  rowUuid: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await commitImportRow(rowUuid);
  } catch (error) {
    return fail(error, "Failed to commit that row");
  }

  revalidatePath(`/imports/${batchUuid}`);
  return { success: true };
};

// Not a form, so no `useActionState` and no prevState to carry: the button has
// nothing to validate and nothing to preserve across a failed submit.
export const commitBatch = async (
  batchUuid: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    const report = await commitImportBatch(batchUuid);
    revalidatePath(`/imports/${batchUuid}`);
    // A partial commit is reported rather than thrown. Rows go one at a time on
    // purpose, so "212 in, 3 still stuck" is a real and useful outcome — not a
    // failure, and not something to hide behind a success tick either.
    if (report.blocked.length > 0) {
      return {
        error: `${report.committed.length} committed, ${report.blocked.length} still waiting: ${report.blocked[0]?.reason ?? ""}`,
      };
    }
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to commit this batch");
  }
};
