"use client";

import type { DesignFinding } from "@/app/cart/actions";
import { ArrowRight, ShieldAlert, TriangleAlert, X } from "lucide-react";

type CompatibilityGateModalProps = {
  blockers: DesignFinding[];
  warnings: DesignFinding[];
  onContinue: () => void;
  onClose: () => void;
};

// The last look before checkout. Blockers (incompatible design) must be fixed —
// there is no "continue" past them. When only warnings remain, the customer can
// proceed with open eyes.
export const CompatibilityGateModal = ({
  blockers,
  warnings,
  onContinue,
  onClose,
}: CompatibilityGateModalProps) => {
  const hasBlockers = blockers.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-lg rounded-[18px] border border-hairline bg-surface p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            {hasBlockers ? (
              <ShieldAlert size={20} className="text-red-600" />
            ) : (
              <TriangleAlert size={20} className="text-amber-600" />
            )}
            <h2 className="font-heading text-lg text-ink">
              {hasBlockers
                ? "Fix these to continue"
                : "Before you send this order"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-faint transition-colors hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <p className="font-grotesk mt-2 text-sm text-muted">
          {hasBlockers
            ? `Your selection has ${blockers.length} blocking ${blockers.length === 1 ? "issue" : "issues"} that must be resolved before ordering.`
            : `Your selection has ${warnings.length} advisory ${warnings.length === 1 ? "warning" : "warnings"}. You can still continue — you may already own the missing equipment.`}
        </p>

        {hasBlockers && (
          <div className="mt-4 flex max-h-52 flex-col gap-3 overflow-y-auto rounded-xl bg-red-50 p-4">
            {blockers.map((finding) => (
              <div key={finding.id} className="font-grotesk text-sm">
                <p className="font-semibold text-red-900">{finding.title}</p>
                <p className="mt-0.5 text-red-800">{finding.message}</p>
              </div>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 flex max-h-40 flex-col gap-3 overflow-y-auto rounded-xl bg-amber-50 p-4">
            {warnings.map((finding) => (
              <div key={finding.id} className="font-grotesk text-sm">
                <p className="font-semibold text-amber-900">{finding.title}</p>
                <p className="mt-0.5 text-amber-800">{finding.message}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="font-grotesk rounded-xl border border-hairline px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            Review my cart
          </button>
          {!hasBlockers && (
            <button
              type="button"
              onClick={onContinue}
              className="font-grotesk inline-flex items-center gap-2 rounded-xl bg-primary-solid px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-solid-hover"
            >
              Continue anyway
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
