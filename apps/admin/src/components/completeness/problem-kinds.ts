import type { CompletenessProblem } from "@/app/(dashboard)/completeness/action";

type ProblemKindMeta = {
  label: string;
  // Whether the engine is left unable to READ the value. Those are the dangerous
  // ones: a rule only fires on items carrying its attribute, so an unreadable
  // value does not fail a check — it skips it, and skipping looks like passing.
  //
  // `outside_slice` is deliberately not one of them. The value is real and the
  // library knows it; the only question is whether this category should offer it,
  // and that is a decision for whoever owns the assignment.
  blocking: boolean;
  // What to actually do about it, in the author's words.
  fix: string;
  badgeClass: string;
};

export const PROBLEM_KINDS: Record<
  CompletenessProblem["kind"],
  ProblemKindMeta
> = {
  missing: {
    label: "No value",
    blocking: true,
    fix: "Answer it on the product. Every rule that reads this attribute is currently skipping this product.",
    badgeClass: "bg-danger-tint text-danger",
  },
  unknown_value: {
    label: "Value not in the library",
    blocking: true,
    fix: "Add the option to the library attribute, or correct the value. Nothing can rank, match or render it as it stands.",
    badgeClass: "bg-danger-tint text-danger",
  },
  incomplete_rows: {
    label: "Rows unreadable",
    blocking: true,
    fix: "Re-open the rows and answer the sub-fields added since they were entered. Readers drop an incomplete row, so the product currently reads as having none.",
    badgeClass: "bg-danger-tint text-danger",
  },
  outside_slice: {
    label: "Not offered here",
    blocking: false,
    fix: "Either widen the category's enabled values or change the product. The value is real and readable — it is the assignment that disagrees with it.",
    badgeClass: "bg-warning-tint text-warning",
  },
  unassigned: {
    label: "Answered but unused",
    blocking: false,
    fix: "Assign the attribute to this category to put the answer to work, or clear it. Until then it is invisible everywhere — do not re-enter it elsewhere.",
    badgeClass: "bg-warning-tint text-warning",
  },
};

export const PROBLEM_KIND_ORDER: CompletenessProblem["kind"][] = [
  "missing",
  "incomplete_rows",
  "unknown_value",
  "outside_slice",
  "unassigned",
];
