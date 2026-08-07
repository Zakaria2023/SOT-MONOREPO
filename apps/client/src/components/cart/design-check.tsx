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
  // Checks that DID clear, without being able to read every product they cover.
  // Separate from `unknowns` because the two are different facts — "we could not
  // look at all" against "we looked, and not at everything" — and separate from
  // the green panel because neither of them is "all clear".
  partial?: DesignFinding[];
};

type FindingRowProps = {
  finding: DesignFinding;
  tone: "block" | "warn";
};

type SkippedRowProps = {
  finding: DesignFinding;
  // Whether the rule reached a verdict on what it COULD read. It changes the
  // sentence entirely, and getting it wrong would either alarm a buyer whose
  // design is fine or reassure one whose design was never checked.
  reachedVerdict: boolean;
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

/**
 * One check that could not run: the rule's name, then a line per product with
 * what was missing from it.
 *
 * The engine's own sentence joins the products with semicolons, which at cart
 * width becomes a paragraph the buyer has to parse to find out that three
 * switches are each missing one value. The parts are on the finding, so the list
 * is built from them and the sentence is used only when a check was skipped for a
 * reason that names no product at all (a unit mismatch in the library, say).
 */
const SkippedRow = ({ finding, reachedVerdict }: SkippedRowProps) => (
  <div className="font-grotesk text-sm">
    <p className="font-semibold text-sky-900">{finding.title}</p>

    {finding.skipped.length > 0 ? (
      <>
        <p className="mt-0.5 text-sky-800">
          {reachedVerdict
            ? "Everything we could read is fine. These were left out of it:"
            : `Missing data on ${
                finding.skipped.length === 1
                  ? "one product"
                  : `${finding.skipped.length} products`
              }, so this check was left out:`}
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {finding.skipped.map((item) => (
            <li
              key={item.productUuid}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-sky-100/70 px-3 py-2"
            >
              <span className="font-medium text-sky-900">{item.name}</span>
              <span className="text-sky-700">
                no value for {item.missing.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </>
    ) : (
      <p className="mt-0.5 text-sky-800">{finding.message}</p>
    )}
  </div>
);

// The customer-facing design check. Groups what the design breaks into blockers
// (must fix to order — a camera with no recorder, an over-budget switch) and
// heads-up warnings (can proceed) so the buyer always knows where they stand.
export const DesignCheck = ({
  blockers,
  warnings,
  unknowns = [],
  partial = [],
}: DesignCheckProps) => {
  if (
    blockers.length === 0 &&
    warnings.length === 0 &&
    unknowns.length === 0 &&
    partial.length === 0
  ) {
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

          <div className="mt-4 flex flex-col gap-4">
            {unknowns.map((finding) => (
              <SkippedRow
                key={finding.id}
                finding={finding}
                reachedVerdict={false}
              />
            ))}
          </div>

          <p className="font-grotesk mt-4 border-t border-sky-200 pt-3 text-xs text-sky-700">
            You can still order. Ask us to confirm these before you install.
          </p>
        </section>
      )}

      {/* A pass that did not cover everything. Its own panel for the same reason
          the unknowns have theirs: it used to be counted as a clean pass, which
          told a buyer their design was checked when most of it never was. */}
      {partial.length > 0 && (
        <section className="rounded-[18px] border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-slate-500" />
            <h2 className="font-heading text-base text-slate-900">
              {partial.length} {partial.length === 1 ? "check" : "checks"}{" "}
              cleared, but not on everything
            </h2>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {partial.map((finding) => (
              <SkippedRow
                key={finding.id}
                finding={finding}
                reachedVerdict={true}
              />
            ))}
          </div>

          <p className="font-grotesk mt-4 border-t border-slate-200 pt-3 text-xs text-slate-600">
            Nothing here is wrong with your design. These products are missing
            values we need, so they sat the check out.
          </p>
        </section>
      )}
    </div>
  );
};
