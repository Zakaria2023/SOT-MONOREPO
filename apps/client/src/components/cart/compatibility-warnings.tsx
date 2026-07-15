"use client";

import { Lightbulb, TriangleAlert } from "lucide-react";
import type { RuleEvaluation } from "services";

type CompatibilityWarningsProps = {
  warnings: RuleEvaluation[];
};

// Advisory banner listing every rule the current cart violates. It never
// blocks anything — the customer may know better (spare parts, existing
// equipment on site) — it just makes sure they decide with open eyes.
export const CompatibilityWarnings = ({
  warnings,
}: CompatibilityWarningsProps) => {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[18px] border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2">
        <TriangleAlert size={18} className="text-amber-600" />
        <h2 className="font-heading text-base text-amber-900">
          Compatibility check
        </h2>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {warnings.map((warning) => (
          <div key={warning.ruleUuid} className="font-grotesk text-sm">
            <p className="font-semibold text-amber-900">{warning.name}</p>
            <p className="mt-0.5 text-amber-800">{warning.message}</p>
            {warning.suggestions.length > 0 && (
              <p className="mt-1 flex items-start gap-1.5 text-amber-700">
                <Lightbulb size={14} className="mt-0.5 shrink-0" />
                <span>
                  Would fit:{" "}
                  {warning.suggestions
                    .map(
                      (suggestion) =>
                        `${suggestion.name} (${suggestion.capacity}${warning.unit ? ` ${warning.unit}` : ""})`,
                    )
                    .join(", ")}
                </span>
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="font-grotesk mt-3 text-xs text-amber-700">
        These are advisory — you can still order everything. You may already
        own the equipment a rule expects.
      </p>
    </section>
  );
};
