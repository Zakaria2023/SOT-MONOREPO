import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

/**
 * A labelled wrapper for a control that is not an `Input`.
 *
 * It exists because `Input` renders its own label as `text-sm font-semibold
 * text-ink` with `gap-2` above the control. Anything hand-rolled beside an Input
 * — a Dropdown, a Combobox — has to use exactly that, or the two controls land on
 * different baselines with visibly different labels. That mismatch is what made
 * the library form look misaligned.
 *
 * So this is the single place that markup lives. A control wrapped here lines up
 * with an Input beside it by construction, not by two files agreeing on the same
 * class list.
 */
export const Field = ({ label, hint, children }: FieldProps) => (
  <div className="flex flex-col gap-2">
    <span className="text-sm font-semibold text-ink">{label}</span>
    <div className="flex flex-col gap-1">
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  </div>
);
