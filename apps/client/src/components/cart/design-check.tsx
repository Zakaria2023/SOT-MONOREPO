"use client";

import { CheckCircle2, Lightbulb, ShieldAlert, TriangleAlert } from "lucide-react";
import type { RuleEvaluation } from "services";

type DesignCheckProps = {
  blockers: RuleEvaluation[];
  warnings: RuleEvaluation[];
};

type FindingRowProps = {
  finding: RuleEvaluation;
  tone: "block" | "warn";
};

const suggestionText = (finding: RuleEvaluation): string =>
  finding.suggestions
    .map(
      (suggestion) =>
        `${suggestion.name}${
          suggestion.capacity
            ? ` (${suggestion.capacity}${finding.unit ? ` ${finding.unit}` : ""})`
            : ""
        }`,
    )
    .join(", ");

const FindingRow = ({ finding, tone }: FindingRowProps) => (
  <div className="font-grotesk text-sm">
    <p
      className={tone === "block" ? "font-semibold text-red-900" : "font-semibold text-amber-900"}
    >
      {finding.name}
    </p>
    <p className={tone === "block" ? "mt-0.5 text-red-800" : "mt-0.5 text-amber-800"}>
      {finding.message}
    </p>
    {finding.suggestions.length > 0 && (
      <p
        className={
          tone === "block"
            ? "mt-1 flex items-start gap-1.5 text-red-700"
            : "mt-1 flex items-start gap-1.5 text-amber-700"
        }
      >
        <Lightbulb size={14} className="mt-0.5 shrink-0" />
        <span>Add one of: {suggestionText(finding)}</span>
      </p>
    )}
  </div>
);

// The customer-facing design check. Groups what the design breaks into
// blockers (must fix to order) and heads-up warnings (can proceed) so the
// buyer always knows exactly where they stand.
export const DesignCheck = ({ blockers, warnings }: DesignCheckProps) => {
  if (blockers.length === 0 && warnings.length === 0) {
    return (
      <section className="flex items-center gap-2 rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 size={18} className="text-emerald-600" />
        <p className="font-grotesk text-sm font-medium text-emerald-900">
          Your design checks out — everything is compatible.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {blockers.length > 0 && (
        <section className="rounded-[18px] border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-600" />
            <h2 className="font-heading text-base text-red-900">
              {blockers.length} {blockers.length === 1 ? "thing" : "things"} to
              fix before you can order
            </h2>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {blockers.map((finding) => (
              <FindingRow key={finding.ruleUuid} finding={finding} tone="block" />
            ))}
          </div>
        </section>
      )}

      {warnings.length > 0 && (
        <section className="rounded-[18px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <TriangleAlert size={18} className="text-amber-600" />
            <h2 className="font-heading text-base text-amber-900">
              {warnings.length} heads-up
            </h2>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {warnings.map((finding) => (
              <FindingRow key={finding.ruleUuid} finding={finding} tone="warn" />
            ))}
          </div>
          <p className="font-grotesk mt-3 text-xs text-amber-700">
            These are advisory — you can still order. You may already own the
            equipment a rule expects.
          </p>
        </section>
      )}
    </div>
  );
};
