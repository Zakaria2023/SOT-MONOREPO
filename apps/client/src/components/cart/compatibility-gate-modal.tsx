"use client";

import { ArrowRight, TriangleAlert, X } from "lucide-react";
import type { RuleEvaluation } from "services";

type CompatibilityGateModalProps = {
  warnings: RuleEvaluation[];
  onContinue: () => void;
  onClose: () => void;
};

// The last look before checkout: the agreed flow warns once in the cart and
// once more here, then lets the customer proceed — a warning, never a wall.
export const CompatibilityGateModal = ({
  warnings,
  onContinue,
  onClose,
}: CompatibilityGateModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
    <div className="w-full max-w-lg rounded-[18px] border border-hairline bg-surface p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <TriangleAlert size={20} className="text-amber-600" />
          <h2 className="font-heading text-lg text-ink">
            Before you send this order
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
        Your selection breaks {warnings.length}{" "}
        {warnings.length === 1 ? "compatibility rule" : "compatibility rules"}.
        You can still continue — you may already own the missing equipment.
      </p>

      <div className="mt-4 flex max-h-64 flex-col gap-3 overflow-y-auto rounded-xl bg-amber-50 p-4">
        {warnings.map((warning) => (
          <div key={warning.ruleUuid} className="font-grotesk text-sm">
            <p className="font-semibold text-amber-900">{warning.name}</p>
            <p className="mt-0.5 text-amber-800">{warning.message}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="font-grotesk rounded-xl border border-hairline px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          Review my cart
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="font-grotesk inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
        >
          Continue anyway
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  </div>
);
