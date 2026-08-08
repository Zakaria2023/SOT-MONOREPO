import type { BoqStatus } from "../../../db/enum";

// ---------------------------------------------------------------------------
// THE BOQ LIFECYCLE, IN ONE PLACE.
//
// A BOQ has eleven statuses and, until now, five different files moved it
// between them: boq.ts wrote `validated` and `submitted`, offers.ts wrote
// `offered`, orders.ts wrote `ordered`, and advanceBoqFulfilment guarded the
// six-step tail from `ordered` to `handed_over`.
//
// Only that last one checked anything. Everything before `ordered` was an
// unguarded write, so a handed-over BOQ could be dragged back to `validated` by
// re-running validation, and a draft could be offered without ever having been
// reviewed. The guard existed for the half of the lifecycle where mistakes are
// cheapest and was absent from the half where a customer is watching.
//
// SEVEN STAGES, ELEVEN STATUSES. The stages are what a person is shown; the
// statuses are what the system moves through. Stage 5 covers three of them,
// because "being installed" is one thing to a customer and three things to a
// scheduler. Neither number is wrong — they answer different questions, and
// collapsing them into one would lose either the customer's view or the
// engineer's.
//
// All pure. A lifecycle you cannot test without a database is one nobody tests.
// ---------------------------------------------------------------------------

export type BoqStage = {
  number: number;
  title: string;
  // What a customer understands by it.
  description: string;
  statuses: BoqStatus[];
};

export const BOQ_STAGES: BoqStage[] = [
  {
    number: 1,
    title: "Being designed",
    description: "The design is still being put together.",
    statuses: ["draft"],
  },
  {
    number: 2,
    title: "Checked",
    description: "The design has been through the compatibility engine.",
    statuses: ["validated", "submitted", "reviewed"],
  },
  {
    number: 3,
    title: "Quoted",
    description: "A price has been offered against it.",
    statuses: ["offered"],
  },
  {
    number: 4,
    title: "Ordered",
    description: "The order is placed.",
    statuses: ["ordered"],
  },
  {
    number: 5,
    title: "Being installed",
    description: "Assigned to a partner and on site.",
    statuses: ["assigned", "installing", "installed"],
  },
  {
    number: 6,
    title: "Verified",
    description: "The installation has been checked and accepted.",
    statuses: ["verified"],
  },
  {
    number: 7,
    title: "Handed over",
    description: "Documentation delivered and the job closed.",
    statuses: ["handed_over"],
  },
];

/**
 * What may follow what.
 *
 * Written as an explicit map rather than derived from an ordered array, because
 * two of these are NOT simple successions and an array cannot say so:
 *
 *   submitted → validated   a review sends a design back to be corrected. The
 *                           fulfilment guard's "next index only" rule makes that
 *                           impossible to express, which is why the front half
 *                           was left unguarded rather than made to fit.
 *   verified  → installing  a failed verification sends the job back to site.
 *   draft     → offered     a design can be quoted before it is formally
 *                           reviewed, skipping two statuses.
 *
 * `handed_over` maps to nothing. It is the end, and the absence of an entry is
 * what says so.
 */
const ALLOWED: Record<BoqStatus, BoqStatus[]> = {
  // A design may be quoted at any point before it is quoted. That is not a
  // relaxation invented here — it is what offers.ts already permits, and an
  // admin quoting a rough draft without a formal review is ordinary. Written
  // down rather than tightened: a model that forbids what the business does
  // gets bypassed, and then it guards nothing.
  draft: ["validated", "offered"],
  validated: ["submitted", "draft", "offered"],
  submitted: ["reviewed", "validated", "offered"],
  reviewed: ["offered", "submitted"],
  offered: ["ordered", "reviewed"],
  ordered: ["assigned"],
  assigned: ["installing"],
  installing: ["installed"],
  installed: ["verified"],
  // A verification that fails sends the job back to site. Without this the only
  // way to record a failed check is to leave the BOQ at `installed` and say
  // nothing, which is how a bad installation gets handed over.
  verified: ["handed_over", "installing"],
  handed_over: [],
};

export type TransitionCheck =
  | { allowed: true }
  | { allowed: false; reason: string };

export const stageOf = (status: BoqStatus): BoqStage => {
  const stage = BOQ_STAGES.find((entry) => entry.statuses.includes(status));
  if (!stage) {
    // Unreachable while BOQ_STAGES covers the enum, and asserted by a test that
    // fails the moment somebody adds a status without placing it in a stage.
    throw new Error(`No stage covers the BOQ status "${status}".`);
  }
  return stage;
};

/** Whether a BOQ may move from one status to another. */
export const canTransition = (
  from: BoqStatus,
  to: BoqStatus,
): TransitionCheck => {
  if (from === to) {
    return { allowed: false, reason: `This BOQ is already ${from}.` };
  }
  const allowed = ALLOWED[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason:
        allowed.length === 0
          ? `A BOQ that is ${from} has finished; it cannot move to ${to}.`
          : `A BOQ that is ${from} can only become ${allowed.join(" or ")}, not ${to}.`,
    };
  }
  return { allowed: true };
};

/** Whether this status is a step backwards from that one. */
export const isRegression = (from: BoqStatus, to: BoqStatus): boolean =>
  stageOf(to).number < stageOf(from).number;

/** Every status reachable in one step. */
export const nextStatuses = (from: BoqStatus): BoqStatus[] => ALLOWED[from] ?? [];

/**
 * Every status a BOQ may be in to become this one.
 *
 * The inverse of the map, so a guard written as a SQL `WHERE status IN (...)`
 * can be built FROM the model rather than restating it. Three files used to
 * carry their own copy of these lists, and a rule spelled out in three places is
 * a rule with three chances to be wrong.
 */
export const statusesThatCanBecome = (target: BoqStatus): BoqStatus[] =>
  (Object.keys(ALLOWED) as BoqStatus[]).filter((from) =>
    ALLOWED[from].includes(target),
  );
