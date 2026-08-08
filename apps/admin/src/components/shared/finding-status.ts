import type { FindingStatus } from "services";

// The five verdicts, spelled one way.
//
// `not_applicable` is deliberately neutral rather than green: it is not a pass,
// and colouring it as one would hide the exact thing an author needs to notice —
// a rule that was supposed to cover this basket and did not engage with it.

export const FINDING_STATUS_STYLE: Record<FindingStatus, string> = {
  pass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  block: "border-red-500/30 bg-red-500/10 text-red-400",
  unknown: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  not_applicable: "border-hairline bg-hover text-secondary",
};

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  pass: "Passes",
  warn: "Warns the buyer",
  block: "Blocks the order",
  unknown: "Cannot be judged",
  not_applicable: "Did not apply",
};
