"use client";

import {
  listRelationVersionsAction,
  restoreRelationVersionAction,
} from "@/app/(dashboard)/assignments/actions";
import type { RelationshipVersionEntry } from "services";
import { History, RotateCcw, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

// ---------------------------------------------------------------------------
// EVERY STATE THIS RULE HAS BEEN IN.
//
// The audit trail could already say a rule changed and who changed it. It could
// not say WHAT — it diffs three scalar fields, and the operands, filters, lookup
// table and presence spec are the parts somebody actually breaks.
//
// Restoring is a forward step, not an undo: it writes the old snapshot back
// through the ordinary save, so the history gains a version saying a restore
// happened rather than losing the versions that came after it.
// ---------------------------------------------------------------------------

type RelationHistoryProps = {
  relationUuid: string;
  relationName: string;
  onClose: () => void;
  onRestored: () => void;
};

export const RelationHistory = ({
  relationUuid,
  relationName,
  onClose,
  onRestored,
}: RelationHistoryProps) => {
  const [versions, setVersions] = useState<RelationshipVersionEntry[]>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    listRelationVersionsAction(relationUuid).then((rows) => {
      if (live) {
        setVersions(rows);
      }
    });
    return () => {
      live = false;
    };
  }, [relationUuid]);

  const restore = (version: number): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await restoreRelationVersionAction(relationUuid, version);
      if (result.error) {
        setError(result.error);
        return;
      }
      setVersions(await listRelationVersionsAction(relationUuid));
      onRestored();
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-primary/40 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <History size={14} />
            What has happened to “{relationName}”
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Restoring writes the old version back as a new one. Nothing in this
            list is ever removed.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the history"
          className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>

      {error && (
        <p className="rounded-control border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400">
          {error}
        </p>
      )}

      {!versions && <p className="text-[11px] text-faint">Loading…</p>}

      {versions?.length === 0 && (
        <p className="text-[11px] text-faint">
          No history yet. The next save will start one.
        </p>
      )}

      {versions?.map((entry, index) => (
        <div
          key={entry.version}
          className="flex flex-col gap-1 rounded-control border border-hairline bg-base px-2.5 py-2"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium text-ink">
              v{entry.version}
              {index === 0 && (
                <span className="ml-2 text-[10px] tracking-wide text-emerald-400 uppercase">
                  current
                </span>
              )}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[11px] text-faint">
                {entry.actorName ?? "—"} ·{" "}
                {new Date(entry.createdAt).toLocaleDateString()}
              </span>
              {index !== 0 && (
                <button
                  type="button"
                  onClick={() => restore(entry.version)}
                  disabled={pending}
                  className="flex items-center gap-1 rounded-control border border-hairline px-1.5 py-0.5 text-[11px] text-secondary hover:bg-hover hover:text-ink disabled:opacity-60"
                >
                  <RotateCcw size={10} />
                  Put this back
                </button>
              )}
            </div>
          </div>

          {entry.note && (
            <p className="text-[11px] text-secondary">{entry.note}</p>
          )}

          {entry.changes.length === 0 ? (
            <p className="text-[11px] text-faint">
              {index === versions.length - 1
                ? "Where the history starts."
                : "No authored field changed."}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {entry.changes.map((change) => (
                <p key={change.field} className="text-[11px] text-secondary">
                  <span className="text-ink">{change.field}</span>{" "}
                  <span className="font-mono">
                    {change.from} → {change.to}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
