"use client";

import type { DesignFinding } from "@/app/cart/actions";
import { CheckCircle2, Lightbulb, ShieldAlert, TriangleAlert } from "lucide-react";

type DesignCheckProps = {
  blockers: DesignFinding[];
  warnings: DesignFinding[];
};

type FindingRowProps = {
  finding: DesignFinding;
  tone: "block" | "warn";
};

const FindingRow = ({ finding, tone }: FindingRowProps) => (
  <div className="font-grotesk text-sm">
    <p className={tone === "block" ? "font-semibold text-red-900" : "font-semibold text-amber-900"}>
      {finding.title}
    </p>
    <p className={tone === "block" ? "mt-0.5 text-red-800" : "mt-0.5 text-amber-800"}>
      {finding.message}
    </p>
    {/* Every correction is one of three shapes — add supply, reduce demand, or
        swap for compatibility — so the buyer is never told only that something
        is wrong. Where the rule is a plain capacity comparison the engine also
        names products that would actually fit. */}
    {finding.corrections.map((correction, index) => (
      <p
        key={index}
        className={
          tone === "block"
            ? "mt-1 flex items-start gap-1.5 text-red-700"
            : "mt-1 flex items-start gap-1.5 text-amber-700"
        }
      >
        <Lightbulb size={14} className="mt-0.5 shrink-0" />
        <span>
          {correction.message}
          {correction.products.length > 0 && (
            <span className="block opacity-80">
              e.g. {correction.products.map((entry) => entry.name).join(", ")}
            </span>
          )}
        </span>
      </p>
    ))}
  </div>
);

// The customer-facing design check. Groups what the design breaks into blockers
// (must fix to order — a camera with no recorder, an over-budget switch) and
// heads-up warnings (can proceed) so the buyer always knows where they stand.
export const DesignCheck = ({ blockers, warnings }: DesignCheckProps) => {
  if (blockers.length === 0 && warnings.length === 0) {
    return (
      <section className="flex items-center gap-2 rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 size={18} className="text-emerald-600" />
        <p className="font-grotesk text-sm font-medium text-emerald-900">
          Your design checks out — everything it needs is here and compatible.
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
              <FindingRow key={finding.id} finding={finding} tone="block" />
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
              <FindingRow key={finding.id} finding={finding} tone="warn" />
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
