"use client";

import {
  baselineScenarioAction,
  deleteScenarioAction,
  runAllScenariosAction,
} from "@/app/(dashboard)/sandbox/actions";
import type { ScenarioRun } from "services";
import { FINDING_STATUS_LABEL } from "@/components/shared/finding-status";
import { CircleCheck, Play, ShieldQuestion, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "ui";

// ---------------------------------------------------------------------------
// THE SUITE.
//
// Nothing runs on load. These evaluate the whole rule set against a real basket
// each, and doing that on every page view would put the sandbox's cost on people
// who came here to try one thing.
//
// The report separates a regression from a change, because a suite over a LIVE
// catalogue drifts for reasons that are nobody's mistake — a rule is authored, a
// product is discontinued — and a report that treats those as failures gets
// ignored by its third false alarm.
// ---------------------------------------------------------------------------

type ScenarioListProps = {
  // Rendered before anything has been run, so the screen can say what exists
  // without paying to evaluate it.
  names: { uuid: string; name: string; note: string | null; baselined: boolean }[];
};

type ScenarioRowProps = {
  run: ScenarioRun;
  onChanged: () => void;
};

const ScenarioRow = ({ run, onChanged }: ScenarioRowProps) => {
  const [pending, startTransition] = useTransition();
  const drift = run.drift;

  const tone = !drift
    ? "border-hairline bg-base"
    : drift.regressed
      ? "border-red-500/30 bg-red-500/10"
      : drift.identical
        ? "border-emerald-500/30 bg-emerald-500/10"
        : "border-amber-500/30 bg-amber-500/10";

  const accept = (): void => {
    startTransition(async () => {
      await baselineScenarioAction(run.scenario.uuid);
      onChanged();
    });
  };

  const remove = (): void => {
    startTransition(async () => {
      await deleteScenarioAction(run.scenario.uuid);
      onChanged();
    });
  };

  return (
    <div className={`flex flex-col gap-2 rounded-card border px-3 py-2.5 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink line-clamp-1">
            {run.scenario.name}
          </p>
          <p className="text-[11px] text-muted">
            {run.scenario.selection.length} line
            {run.scenario.selection.length === 1 ? "" : "s"} ·{" "}
            {run.actual.rules.length} rule
            {run.actual.rules.length === 1 ? "" : "s"} ran
            {run.scenario.baselinedBy &&
              ` · agreed by ${run.scenario.baselinedBy}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {(!drift || !drift.identical) && (
            <button
              type="button"
              onClick={accept}
              disabled={pending}
              className="rounded-control border border-hairline px-2 py-1 text-[11px] text-secondary hover:bg-hover hover:text-ink disabled:opacity-60"
            >
              {drift ? "Accept this" : "Set the baseline"}
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={`Delete ${run.scenario.name}`}
            className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400 disabled:opacity-60"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {run.scenario.note && (
        <p className="text-[11px] text-secondary">{run.scenario.note}</p>
      )}

      {/* No baseline is not a pass. Nobody has said what this should do yet. */}
      {!drift && (
        <p className="flex items-center gap-1.5 text-[11px] text-secondary">
          <ShieldQuestion size={12} />
          Never agreed to. Read the verdict, then set it as the baseline.
        </p>
      )}

      {drift?.identical && (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
          <CircleCheck size={12} />
          Exactly as agreed.
        </p>
      )}

      {drift && drift.changed.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {drift.changed.map((change) => (
            <p key={change.relationshipUuid} className="text-[11px] text-red-400">
              <span className="font-medium">{change.name}</span>{" "}
              {FINDING_STATUS_LABEL[change.before].toLowerCase()} →{" "}
              {FINDING_STATUS_LABEL[change.after].toLowerCase()}
            </p>
          ))}
        </div>
      )}

      {/* Same verdict, fewer products behind it. The regression a status
          comparison cannot see. */}
      {drift?.coverage.map((change) => (
        <p key={change.relationshipUuid} className="text-[11px] text-amber-500">
          <span className="font-medium">{change.name}</span> still{" "}
          {FINDING_STATUS_LABEL[change.status].toLowerCase()}, but{" "}
          {change.newlySkipped.length > 0
            ? `${change.newlySkipped.length} product(s) it used to read are now being skipped`
            : `${change.newlyRead.length} product(s) it used to skip are now readable`}
        </p>
      ))}

      {drift && drift.appeared.length > 0 && (
        <p className="text-[11px] text-secondary">
          {drift.appeared.length} rule(s) authored since:{" "}
          {drift.appeared.map((rule) => rule.name).join(", ")}
        </p>
      )}

      {drift && drift.disappeared.length > 0 && (
        <p className="text-[11px] text-secondary">
          {drift.disappeared.length} rule(s) deleted since:{" "}
          {drift.disappeared.map((rule) => rule.name).join(", ")}
        </p>
      )}
    </div>
  );
};

export const ScenarioList = ({ names }: ScenarioListProps) => {
  const [runs, setRuns] = useState<ScenarioRun[]>();
  const [running, setRunning] = useState(false);

  const runAll = async (): Promise<void> => {
    setRunning(true);
    try {
      setRuns(await runAllScenariosAction());
    } finally {
      setRunning(false);
    }
  };

  if (names.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-xs text-faint">
        No saved scenarios yet. Run a basket above and keep it, so the next
        person to edit a rule finds out if they broke it.
      </p>
    );
  }

  const regressions = (runs ?? []).filter(
    (run) => run.drift?.regressed === true,
  ).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-base px-3 py-2.5">
        <p className="text-xs text-secondary">
          {names.length} scenario{names.length === 1 ? "" : "s"} ·{" "}
          {names.filter((entry) => !entry.baselined).length} with no agreed
          verdict
          {runs &&
            (regressions === 0
              ? " · nothing regressed"
              : ` · ${regressions} regressed`)}
        </p>
        <Button onClick={runAll} disabled={running}>
          <Play size={13} />
          {running ? "Running…" : "Run them all"}
        </Button>
      </div>

      {runs
        ? runs.map((run) => (
            <ScenarioRow
              key={run.scenario.uuid}
              run={run}
              onChanged={runAll}
            />
          ))
        : names.map((entry) => (
            <div
              key={entry.uuid}
              className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-base px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-ink line-clamp-1">{entry.name}</p>
                {entry.note && (
                  <p className="text-[11px] text-muted line-clamp-1">
                    {entry.note}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[11px] text-faint">
                {entry.baselined ? "Agreed" : "No baseline"}
              </span>
            </div>
          ))}
    </div>
  );
};
