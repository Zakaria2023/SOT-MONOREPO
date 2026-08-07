"use client";

import {
  runDesignCheckAction,
  searchProductsAction,
  traceDesignAction,
} from "@/app/(dashboard)/sandbox/actions";
import type { DesignCheckResult, DesignQuestion, TracedRule } from "services";
import {
  BasketBuilder,
  type BasketLine,
} from "@/components/shared/basket-builder";
import { FieldSet } from "@/components/shared/field";
import { FindingCard } from "@/components/sandbox/finding-card";
import { QuestionField } from "@/components/sandbox/question-field";
import { SaveScenario } from "@/components/sandbox/save-scenario";
import { TraceList } from "@/components/sandbox/trace-list";
import type { ProjectAnswers } from "@/db/types";
import {
  CheckCircle2,
  ListChecks,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "ui";

// ---------------------------------------------------------------------------
// THE SANDBOX.
//
// The single-rule preview answers "does my rule fire?". This answers the
// question that actually decides whether the catalogue is trustworthy: given a
// basket, what do ALL the rules say together?
//
// Those are not the same question. A rule that reads correctly on its own can
// still contradict another one — block what a second rule's correction tells the
// buyer to add, or warn about the thing a third rule requires. Nothing catches
// that except running the whole set at once, which is what the buyer does and
// what nobody here could do until now.
// ---------------------------------------------------------------------------

type Attached = {
  byFinding: Map<string, DesignQuestion[]>;
  unattached: DesignQuestion[];
};

const EMPTY_ATTACHED: Attached = { byFinding: new Map(), unattached: [] };

export const DesignSandbox = () => {
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [answers, setAnswers] = useState<ProjectAnswers>({});
  const [result, setResult] = useState<DesignCheckResult>();
  const [trace, setTrace] = useState<TracedRule[]>();
  const [seen, setSeen] = useState<DesignQuestion[]>([]);
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [tracing, setTracing] = useState(false);

  const nameOf = (uuid: string): string =>
    lines.find((line) => line.productUuid === uuid)?.name ?? "a removed product";

  // Changing the basket invalidates the verdict on screen. Answers survive:
  // they describe the project, not the basket, so re-asking for them every time
  // a line moves would make the screen unusable.
  const changeLines = (next: BasketLine[]): void => {
    setResult(undefined);
    setTrace(undefined);
    setLines(next);
  };

  const answer = (uuid: string, value: number | boolean | null): void => {
    setAnswers((current) => {
      const next = { ...current };
      if (value === null) {
        delete next[uuid];
        return next;
      }
      next[uuid] = value;
      return next;
    });
  };

  const showTrace = async (): Promise<void> => {
    setError(undefined);
    setTracing(true);
    try {
      const outcome = await traceDesignAction(
        lines.map((line) => ({
          productUuid: line.productUuid,
          quantity: line.quantity,
        })),
        answers,
      );
      if (outcome.error || !outcome.trace) {
        setError(outcome.error ?? "The trace returned nothing.");
        return;
      }
      setTrace(outcome.trace);
    } finally {
      setTracing(false);
    }
  };

  const run = async (): Promise<void> => {
    setError(undefined);
    setRunning(true);
    // A previous trace describes the previous answers. Dropped rather than left
    // beside a fresh verdict it no longer matches.
    setTrace(undefined);
    try {
      const outcome = await runDesignCheckAction(
        lines.map((line) => ({
          productUuid: line.productUuid,
          quantity: line.quantity,
        })),
        answers,
      );
      const checked = outcome.result;
      if (outcome.error || !checked) {
        setError(outcome.error ?? "The check returned nothing.");
        setResult(undefined);
        return;
      }
      setResult(checked);
      // Remember every question ever asked this session. A question answered
      // into silence would otherwise take its own input off the screen, leaving
      // an answer in force that nobody can see or take back.
      setSeen((current) => {
        const known = new Set(current.map((question) => question.uuid));
        return [
          ...current,
          ...checked.questions.filter((question) => !known.has(question.uuid)),
        ];
      });
    } finally {
      setRunning(false);
    }
  };

  const reset = (): void => {
    setLines([]);
    setAnswers({});
    setResult(undefined);
    setTrace(undefined);
    setSeen([]);
    setError(undefined);
  };

  const findings = useMemo(
    () =>
      result
        ? [
            ...result.blockers,
            ...result.warnings,
            ...result.unknowns,
            ...result.partial,
          ]
        : [],
    [result],
  );

  // Each question belongs to the first finding it affects. A question that hangs
  // off three findings rendered three times would read as three questions.
  const attached = useMemo<Attached>(() => {
    if (!result) {
      return EMPTY_ATTACHED;
    }
    const byFinding = new Map<string, DesignQuestion[]>();
    const claimed = new Set<string>();
    for (const finding of findings) {
      const mine = result.questions.filter(
        (question) =>
          !claimed.has(question.uuid) && question.affects.includes(finding.id),
      );
      if (mine.length > 0) {
        for (const question of mine) {
          claimed.add(question.uuid);
        }
        byFinding.set(finding.id, mine);
      }
    }
    return {
      byFinding,
      unattached: result.questions.filter(
        (question) => !claimed.has(question.uuid),
      ),
    };
  }, [result, findings]);

  // Answered earlier, not asked by this run. Still in force, so still shown —
  // otherwise the only way to undo one is to reload the page.
  const lingering = seen.filter(
    (question) =>
      question.uuid in answers &&
      !result?.questions.some((asked) => asked.uuid === question.uuid),
  );

  const clean =
    result !== undefined && findings.length === 0 && !result.degraded;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <FieldSet
          title="The basket"
          hint="Nothing here is anyone's cart. Nothing is written."
          accessory={
            lines.length > 0 || result ? (
              <button
                type="button"
                onClick={reset}
                className="flex shrink-0 items-center gap-1 rounded-control px-1.5 py-1 text-[11px] text-faint hover:bg-hover hover:text-ink"
              >
                <RotateCcw size={11} />
                Start over
              </button>
            ) : undefined
          }
        >
          <BasketBuilder
            lines={lines}
            onChange={changeLines}
            search={searchProductsAction}
            emptyHint="Add the products whose combination you want to put through the gate."
          />
        </FieldSet>

        {lingering.length > 0 && (
          <FieldSet
            title="Still in force"
            hint="Answered earlier. This run did not ask, but the value is still being used."
          >
            <div className="flex flex-col gap-1.5">
              {lingering.map((question) => (
                <div
                  key={question.uuid}
                  className="flex items-center gap-2 rounded-control border border-hairline bg-base px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 text-xs text-ink line-clamp-1">
                    {question.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-secondary">
                    {String(answers[question.uuid])}
                    {question.unit ? ` ${question.unit}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => answer(question.uuid, null)}
                    className="shrink-0 rounded-control px-1.5 py-0.5 text-[11px] text-faint hover:bg-hover hover:text-ink"
                  >
                    Clear
                  </button>
                </div>
              ))}
            </div>
          </FieldSet>
        )}

        {error && (
          <p className="rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <Button onClick={run} disabled={running || lines.length === 0}>
          {running ? "Running…" : "Run the check"}
        </Button>

        {/* Only after a run. Keeping a basket nobody has looked at produces a
            scenario whose verdict is a surprise to whoever saved it. */}
        {result && <SaveScenario lines={lines} answers={answers} />}
      </div>

      <div className="flex flex-col gap-3">
        {!result && (
          <p className="rounded-card border border-dashed border-hairline px-4 py-16 text-center text-xs text-faint">
            Build a basket and run it. You will see exactly what a buyer with
            these products in their cart would see.
          </p>
        )}

        {/* A check that could not run must never be mistaken for one that
            passed — the same reason the service carries the flag at all. */}
        {result?.degraded && (
          <div className="flex items-center gap-2 rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
            <TriangleAlert size={14} className="shrink-0" />
            The engine failed on this basket. Nothing below is a verdict — the
            check did not complete. The server log has the reason.
          </div>
        )}

        {result && !result.degraded && (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-base px-3 py-2.5 text-xs">
            <span className="text-secondary">
              <span className="font-medium text-ink">{result.passed}</span>{" "}
              passed
            </span>
            <span className="text-secondary">
              <span className="font-medium text-ink">
                {result.partial.length}
              </span>{" "}
              partial
            </span>
            <span className="text-secondary">
              <span className="font-medium text-red-400">
                {result.blockers.length}
              </span>{" "}
              blocking
            </span>
            <span className="text-secondary">
              <span className="font-medium text-amber-500">
                {result.warnings.length}
              </span>{" "}
              warning
            </span>
            <span className="text-secondary">
              <span className="font-medium text-blue-400">
                {result.unknowns.length}
              </span>{" "}
              unjudged
            </span>
          </div>
        )}

        {clean && (
          <div className="flex items-center gap-2 rounded-card border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-400">
            <CheckCircle2 size={14} className="shrink-0" />
            Nothing to flag. This basket would go through.
          </div>
        )}

        {findings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            nameOf={nameOf}
            questions={attached.byFinding.get(finding.id) ?? []}
            answers={answers}
            onAnswer={answer}
          />
        ))}

        {attached.unattached.length > 0 && (
          <FieldSet
            title="Also worth answering"
            hint="These change a verdict above, but the engine did not tie them to one finding."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {attached.unattached.map((question) => (
                <QuestionField
                  key={question.uuid}
                  question={question}
                  answers={answers}
                  onAnswer={answer}
                />
              ))}
            </div>
          </FieldSet>
        )}

        {/* The findings above are the buyer's half. This is the author's: the
            rules that produced no finding at all, which the buyer must never be
            shown and the author cannot work without. */}
        {result && !result.degraded && (
          <div className="flex flex-col gap-3 border-t border-hairline pt-3">
            {trace ? (
              <TraceList trace={trace} />
            ) : (
              <button
                type="button"
                onClick={showTrace}
                disabled={tracing}
                className="flex items-center justify-center gap-1.5 rounded-control border border-hairline px-3 py-2 text-xs text-secondary hover:bg-hover hover:text-ink disabled:opacity-60"
              >
                <ListChecks size={13} />
                {tracing ? "Tracing…" : "Show every rule, including the silent ones"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
