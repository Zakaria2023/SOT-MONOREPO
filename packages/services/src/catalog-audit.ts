import { and, desc, eq, like, or } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type { CatalogAuditAction, CatalogAuditTarget } from "../../../db/enum";
import {
  CatalogAudit,
  type SelectCatalogAudit,
} from "../../../db/schema/catalog-audit";

export type { SelectCatalogAudit };

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

export type AuditFilters = {
  target?: CatalogAuditTarget;
  action?: CatalogAuditAction;
  // One row's whole history — "what has been done to this rule".
  targetUuid?: string;
  // Matched against what was changed and who changed it, because those are the
  // two things anybody actually remembers about an edit.
  search?: string;
  limit?: number;
};

/**
 * The trail, newest first, narrowed in SQL.
 *
 * In SQL and not in memory, and that is the whole point of this function
 * existing: reading the last hundred rows and then keeping the deletions gives
 * "the deletions among the last hundred changes", which an author will read as
 * "the last hundred deletions". The index on (target, target_uuid) and the one on
 * created_at are what make the narrowed read cheap.
 */
export const getAuditFeed = async (
  filters: AuditFilters = {},
): Promise<SelectCatalogAudit[]> => {
  const conditions = [
    filters.target ? eq(CatalogAudit.target, filters.target) : undefined,
    filters.action ? eq(CatalogAudit.action, filters.action) : undefined,
    filters.targetUuid
      ? eq(CatalogAudit.targetUuid, filters.targetUuid)
      : undefined,
    filters.search
      ? or(
          like(CatalogAudit.targetLabel, `%${filters.search}%`),
          like(CatalogAudit.actorName, `%${filters.search}%`),
        )
      : undefined,
  ].filter((condition) => condition !== undefined);

  return db
    .select()
    .from(CatalogAudit)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(CatalogAudit.createdAt))
    .limit(filters.limit ?? 100);
};

/** The recent history of one row, newest first. */
export const getAuditTrail = async (
  targetUuid: string,
  limit = 50,
): Promise<SelectCatalogAudit[]> => getAuditFeed({ targetUuid, limit });

/** The whole catalog history, newest first — the admin activity feed. */
export const getRecentAudit = async (
  limit = 100,
): Promise<SelectCatalogAudit[]> => getAuditFeed({ limit });
