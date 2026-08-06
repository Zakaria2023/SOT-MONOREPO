import type { ReactNode } from "react";

type FieldSetProps = {
  title: string;
  hint?: ReactNode;
  accessory?: ReactNode;
  children: ReactNode;
};

type FieldProps = {
  label: string;
  hint?: ReactNode;
  // Sits on the label's own row, right-aligned — a reset link, a count. Mirrors
  // `Input`'s `labelAccessory`, for the same reason: a control beside an Input
  // has to put its extras on the same line or the two rows stop lining up.
  accessory?: ReactNode;
  children: ReactNode;
};

/**
 * A labelled wrapper for a control that is not an `Input`.
 *
 * It exists because `Input` renders its own label as `text-sm font-medium
 * text-ink` with `gap-2` above the control. Anything hand-rolled beside an Input
 * — a Dropdown, a Combobox — has to use exactly that, or the two controls land on
 * different baselines with visibly different labels. That mismatch is what made
 * the library form look misaligned.
 *
 * So this is the single place that markup lives. A control wrapped here lines up
 * with an Input beside it by construction, not by two files agreeing on the same
 * class list.
 */
export const Field = ({ label, hint, accessory, children }: FieldProps) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      {accessory}
    </div>
    <div className="flex flex-col gap-1">
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  </div>
);

/**
 * A titled box grouping several fields — one side of a rule, one presence
 * requirement, the lookup table.
 *
 * Same reasoning as `Field`: these boxes sit next to each other, so the title
 * weight, the border and the padding have to come from one place rather than
 * from five files that happen to agree today.
 */
export const FieldSet = ({
  title,
  hint,
  accessory,
  children,
}: FieldSetProps) => (
  <div className="flex flex-col gap-3 rounded-card border border-hairline bg-base/40 p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink">{title}</span>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {accessory}
    </div>
    {children}
  </div>
);
