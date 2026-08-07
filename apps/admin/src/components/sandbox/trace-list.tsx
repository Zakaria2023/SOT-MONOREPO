"use client";

import type { FindingStatus, TracedRule } from "services";
import {
  FINDING_STATUS_LABEL,
  FINDING_STATUS_STYLE,
} from "@/components/shared/finding-status";

// ---------------------------------------------------------------------------
// EVERY RULE, INCLUDING THE ONES THAT SAID NOTHING.
//
// The buyer is shown what is wrong with their basket. An author needs the
// opposite: the rules that stayed quiet, because `not_applicable` is where a
// rule meant to cover this basket quietly failed to engage — and `pass` is the
// only evidence a rule ran at all.
//
// Ordered by how much attention each verdict deserves, not by rule name.
// ---------------------------------------------------------------------------

type TraceListProps = {
  trace: TracedRule[];
};

type TraceRowProps = {
  traced: TracedRule;
};

const ORDER: FindingStatus[] = [
  "block",
  "warn",
  "unknown",
  "not_applicable",
  "pass",
];

const TraceRow = ({ traced }: TraceRowProps) => {
  const { finding, summary } = traced;
  const measured =
    finding.status !== "not_applicable" &&
    (finding.demand !== 0 || finding.capacity !== 0);

  return (
    <div
      className={`flex flex-col gap-1 rounded-card border px-3 py-2 ${FINDING_STATUS_STYLE[finding.status]}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-xs font-medium line-clamp-1">
          {finding.name}
        </span>
        <span className="shrink-0 text-[10px] font-semibold tracking-wide uppercase">
          {FINDING_STATUS_LABEL[finding.status]}
        </span>
      </div>

      {/* The rule's own reading, so a silent row can be judged without opening
          the authoring form to remember what it asks for. */}
      {summary && <p className="text-[11px] opacity-80">{summary}</p>}

      {finding.status !== "not_applicable" && (
        <p className="text-[11px]">{finding.message}</p>
      )}

      {measured && (
        <p className="font-mono text-[11px] opacity-80">
          demand {finding.demand}
          {finding.unit ?? ""} · capacity {finding.capacity}
          {finding.unit ?? ""}
          {finding.effectiveCapacity !== finding.capacity &&
            ` · after headroom ${finding.effectiveCapacity}${finding.unit ?? ""}`}
        </p>
      )}

      {finding.skipped.length > 0 && (
        <p className="text-[11px] opacity-80">
          skipped:{" "}
          {finding.skipped
            .map((item) => `${item.name} (no ${item.missing.join(", ")})`)
            .join("; ")}
        </p>
      )}

      {/* The bin packing. The engine has always computed which physical unit
          each item was placed on, and nothing has ever shown it — so "over
          budget across 4 devices" was as much as anyone could find out. For
          whoever is debugging the rule, WHICH switch filled up is the answer. */}
      {finding.bins.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {finding.bins.map((bin) => (
            <p
              key={`${bin.productUuid}-${bin.unitIndex}`}
              className="flex items-baseline justify-between gap-2 font-mono text-[11px] opacity-80"
            >
              <span className="min-w-0 line-clamp-1">
                {bin.name} #{bin.unitIndex + 1}
                {bin.items.length > 0 &&
                  ` · ${bin.items
                    .map((item) => `${item.count}× ${item.name}`)
                    .join(", ")}`}
              </span>
              <span className="shrink-0">
                {bin.used}/{bin.capacity}
                {finding.unit ?? ""}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export const TraceList = ({ trace }: TraceListProps) => {
  const ranked = [...trace].sort(
    (a, b) =>
      ORDER.indexOf(a.finding.status) - ORDER.indexOf(b.finding.status),
  );
  const silent = ranked.filter(
    (traced) => traced.finding.status === "not_applicable",
  ).length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted">
        {ranked.length} rule{ranked.length === 1 ? "" : "s"} ran.{" "}
        {silent === 0
          ? "Every one of them engaged with this basket."
          : `${silent} found nothing here to judge — if one of those was meant to cover this basket, it is not doing so.`}
      </p>

      {ranked.map((traced) => (
        <TraceRow key={traced.finding.relationshipUuid} traced={traced} />
      ))}
    </div>
  );
};
