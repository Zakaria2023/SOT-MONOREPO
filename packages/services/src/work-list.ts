import type { BoqStatus } from "../../../db/enum";
import { nextStatuses, stageOf } from "./boq-lifecycle";

// ---------------------------------------------------------------------------
// P8 — WHAT THIS PARTNER HAS TO DO.
//
// P7 already answers "tell me about this job". This answers the question a
// partner actually opens the app with: what needs doing today, across all of
// them. Without it the only way to find the job waiting on you is to open each
// one in turn, which means the job nobody opens is the job nobody does.
//
// THE NEXT ACTION IS DERIVED, NEVER STORED. It comes from the same lifecycle map
// that guards the transition — so the button a partner is offered and the move
// the server will accept cannot disagree. A stored "next step" column would
// drift from the guard the first time the lifecycle changed.
//
// Ordering is by what is BLOCKING somebody else, not by date. A job sitting at
// `installed` is waiting on our verification and the customer is waiting on us; a
// job at `assigned` is waiting on the partner. Newest-first would bury the one
// that has been stuck longest, which is exactly the one worth chasing.
// ---------------------------------------------------------------------------

export type WorkUrgency =
  // Ours to move, and somebody is waiting.
  | "do_now"
  // Ours to move, nothing waiting on it yet.
  | "scheduled"
  // Waiting on somebody else — visible so a partner knows it is not theirs.
  | "waiting_on_us"
  // Finished. Kept briefly so a partner can see what they completed.
  | "done";

export type WorkItem<T> = {
  job: T;
  status: BoqStatus;
  stageNumber: number;
  stageTitle: string;
  urgency: WorkUrgency;
  // What this partner may do next, from the lifecycle map. Empty when the next
  // move is not theirs.
  actions: BoqStatus[];
  // One line, in the partner's words.
  callToAction: string;
};

// Which statuses a PARTNER may move. Deliberately narrow: they own the site
// work, and nothing before or after it. Quoting is the pre-seller's, verifying
// is ours, and a partner who could mark their own installation verified would be
// signing off their own work.
const PARTNER_MOVES: BoqStatus[] = ["assigned", "installing", "installed"];

// Their own work first, then what is on our desk. Caught by driving it: this
// ranked `waiting_on_us` above `scheduled` while the screen rendered the groups
// the other way round, so the sorted list and the page disagreed about what
// mattered. A partner cares most about the job in their hands.
const URGENCY_ORDER: Record<WorkUrgency, number> = {
  do_now: 0,
  scheduled: 1,
  waiting_on_us: 2,
  done: 3,
};

const CALL_TO_ACTION: Partial<Record<BoqStatus, string>> = {
  assigned: "Accept and start on site",
  installing: "Mark the installation finished",
  installed: "Waiting on our verification",
  verified: "Verified — assemble the handover pack",
  handed_over: "Handed over",
  offered: "Quoted, waiting on the customer",
  ordered: "Ordered, waiting to be assigned",
};

const urgencyOf = (status: BoqStatus): WorkUrgency => {
  if (status === "handed_over") {
    return "done";
  }
  if (status === "installed") {
    // Theirs is finished; ours has not started. Shown so a partner is not
    // chasing something that is on our desk.
    return "waiting_on_us";
  }
  if (PARTNER_MOVES.includes(status)) {
    // `assigned` is a job nobody has started. That is the one worth surfacing
    // hardest — an unstarted job is the one a customer is waiting on with
    // nothing happening at all.
    return status === "assigned" ? "do_now" : "scheduled";
  }
  return "waiting_on_us";
};

/**
 * A partner's jobs, ordered by what needs doing.
 *
 * Generic over the job row so this stays pure — the caller supplies whatever it
 * read, and the shape of that read is not this function's business.
 */
export const buildWorkList = <T extends { status: BoqStatus | null }>(
  jobs: T[],
): WorkItem<T>[] =>
  jobs
    .map((job) => {
      const status = job.status ?? "draft";
      const stage = stageOf(status);
      const urgency = urgencyOf(status);

      return {
        job,
        status,
        stageNumber: stage.number,
        stageTitle: stage.title,
        urgency,
        // Intersected with the lifecycle map rather than listed here, so the
        // button offered and the move the server accepts come from one place.
        actions: PARTNER_MOVES.includes(status)
          ? nextStatuses(status).filter(
              (next) =>
                PARTNER_MOVES.includes(next) || next === "installed",
            )
          : [],
        callToAction: CALL_TO_ACTION[status] ?? stage.title,
      };
    })
    .sort(
      (a, b) =>
        URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
        // Within a bucket, the one stuck longest first. That is the one worth
        // chasing, and newest-first would bury it.
        a.stageNumber - b.stageNumber,
    );

/** How many need doing right now — the number worth putting on a badge. */
export const countDoNow = <T extends { status: BoqStatus | null }>(
  jobs: T[],
): number => buildWorkList(jobs).filter((item) => item.urgency === "do_now")
  .length;
