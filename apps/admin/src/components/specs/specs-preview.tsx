"use client";

import type { SpecFormValues } from "@/lib/specs";
import { useFormContext, useWatch } from "react-hook-form";

export const SpecsPreview = () => {
  const { control } = useFormContext<SpecFormValues>();
  const highlights = useWatch({ control, name: "highlights" }) ?? [];
  const specGroups = useWatch({ control, name: "specGroups" }) ?? [];

  const isEmpty = highlights.length === 0 && specGroups.length === 0;

  return (
    <div className="flex flex-col gap-4 rounded-control border border-hairline bg-hover/40 p-4">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-ink">Specifications</span>
        <span className="text-xs text-muted">
          Inherited from the selected category. Manage these on the category.
        </span>
      </div>

      {isEmpty ? (
        <p className="text-sm text-faint">
          Select a category to inherit its highlights and spec groups.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {highlights.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                Highlights
              </span>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {highlights.map((highlight, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-control bg-surface px-3 py-2 text-sm"
                  >
                    <span className="text-muted">{highlight.k}</span>
                    <span className="font-medium text-ink">{highlight.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {specGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                {group.title}
              </span>
              <div className="flex flex-col divide-y divide-hairline-soft rounded-control bg-surface">
                {group.rows.map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="text-muted">{row.k}</span>
                    <span className="font-medium text-ink">{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
