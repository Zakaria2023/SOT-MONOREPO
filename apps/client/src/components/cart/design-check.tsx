"use client";

import type { DesignFinding } from "@/app/cart/actions";
import {
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

type DesignCheckProps = {
  blockers: DesignFinding[];
  warnings: DesignFinding[];
  // Checks that could not be run at all — a product missing a value the rule
  // needed, or a question the buyer has not answered. Shown, never dropped: a
  // check we could not run must not look like a check that passed, and the
  // green "your design checks out" panel is exactly what it would look like.
  unknowns?: DesignFinding[];
};

type FindingRowProps = {
  finding: DesignFinding;
  tone: "block" | "warn";
};

const FindingRow = ({ finding, tone }: FindingRowProps) => (
  <div className="font-grotesk text-sm">
    <p
      className={
        tone === "block"
          ? "font-semibold text-red-900"
          : "font-semibold text-amber-900"
      }
    >
      {finding.title}
    </p>
    <p
      className={
        tone === "block" ? "mt-0.5 text-red-800" : "mt-0.5 text-amber-800"
      }
    >
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
export const DesignCheck = ({
  blockers,
  warnings,
  unknowns = [],
}: DesignCheckProps) => {
  if (blockers.length === 0 && warnings.length === 0 && unknowns.length === 0) {
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

      {/* Deliberately its own panel and not folded into the warnings. "We
          checked and it is fine" and "we could not check" are different facts,
          and only one of them is a reason to look again. */}
      {unknowns.length > 0 && (
        <section className="rounded-[18px] border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-sky-600" />
            <h2 className="font-heading text-base text-sky-900">
              {unknowns.length} {unknowns.length === 1 ? "check" : "checks"} we
              could not run
            </h2>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {unknowns.map((finding) => (
              <div key={finding.id} className="font-grotesk text-sm">
                <p className="font-semibold text-sky-900">{finding.title}</p>
                <p className="mt-0.5 text-sky-800">{finding.message}</p>
              </div>
            ))}
          </div>
          <p className="font-grotesk mt-3 text-xs text-sky-700">
            You can still order. Ask us to confirm these before you install.
          </p>
        </section>
      )}
    </div>
  );
};
