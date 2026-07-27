import { desc, eq } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type { CatalogAuditAction, CatalogAuditTarget } from "../../../db/enum";
import { CatalogAudit } from "../../../db/schema/catalog-audit";

// The audit trail. Rules and assignments are what get blamed when a sale is
// blocked, so "why did this cart stop, and who turned that rule on?" has to be
// answerable without guessing.
//
// Writing it never fails the operation it is recording: losing an audit line is
// bad, but rolling back a legitimate catalog edit because the audit insert hit a
// deadlock is worse.

export type AuditActor = {
  uuid: string;
  name: string;
};

export type AuditEntry = {
  target: CatalogAuditTarget;
  action: CatalogAuditAction;
  targetUuid: string;
  // Stored as it was at the time, so the trail still reads correctly after the
  // thing it refers to has been renamed or deleted.
  targetLabel: string;
  actor?: AuditActor;
  changes?: { field: string; from: unknown; to: unknown }[];
};

export const recordAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    await db.insert(CatalogAudit).values({
      uuid: generateUuid(),
      target: entry.target,
      action: entry.action,
      targetUuid: entry.targetUuid,
      targetLabel: entry.targetLabel,
      actorUuid: entry.actor?.uuid ?? null,
      actorName: entry.actor?.name ?? null,
      changes: entry.changes ?? null,
    });
  } catch (error) {
    console.error("recordAudit failed:", error);
  }
};

/**
 * Record many entries in ONE insert.
 *
 * A loop of `recordAudit` is a round trip per row, and against a remote database
 * that is the difference between a form that saves and a form somebody thinks
 * has hung. Same swallow-and-log behaviour: an audit failure must never be the
 * reason a catalog change is lost.
 */
export const recordAuditBatch = async (
  entries: AuditEntry[],
): Promise<void> => {
  if (entries.length === 0) {
    return;
  }
  try {
    await db.insert(CatalogAudit).values(
      entries.map((entry) => ({
        uuid: generateUuid(),
        target: entry.target,
        action: entry.action,
        targetUuid: entry.targetUuid,
        targetLabel: entry.targetLabel,
        actorUuid: entry.actor?.uuid ?? null,
        actorName: entry.actor?.name ?? null,
        changes: entry.changes ?? null,
      })),
    );
  } catch (error) {
    console.error("recordAuditBatch failed:", error);
  }
};

/** The recent history of one row, newest first. */
export const getAuditTrail = async (targetUuid: string, limit = 50) =>
  db
    .select()
    .from(CatalogAudit)
    .where(eq(CatalogAudit.targetUuid, targetUuid))
    .orderBy(desc(CatalogAudit.createdAt))
    .limit(limit);

/** The whole catalog history, newest first — the admin activity feed. */
export const getRecentAudit = async (limit = 100) =>
  db
    .select()
    .from(CatalogAudit)
    .orderBy(desc(CatalogAudit.createdAt))
    .limit(limit);
