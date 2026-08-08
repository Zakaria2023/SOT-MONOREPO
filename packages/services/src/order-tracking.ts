import type { BoqStatus, OrderStatus } from "../../../db/enum";
import { BOQ_STAGES, stageOf } from "./boq-lifecycle";

// ---------------------------------------------------------------------------
// E9 — WHERE HAS MY ORDER GOT TO?
//
// The customer's order page said one of four things: the cash instructions, or
// "Payment received", or a cancellation, or a status label. From the moment the
// money landed to the moment the documentation arrived — assignment, a partner
// on site, the installation finishing, our verification, the handover pack —
// they were told nothing at all.
//
// The information existed the whole time. The BOQ moves through eleven statuses
// and the partner has had a screen since P8 that reads exactly this and tells
// them what to do about it. The customer, who is the one waiting, had no view of
// it. So this is the same lifecycle read from the other side.
//
// THE FIELD THAT MATTERS IS `waitingOn`, NOT THE STEP NUMBER. A progress bar
// tells somebody how far along they are; it does not tell them whether anything
// is expected OF THEM. Those are different questions and the second is the one
// that generates the phone call. An order sitting at `awaiting_payment` for a
// week is waiting on the customer, and a screen that shows it as "step 4 of 7"
// without saying so has actively misled them.
//
// AND IT MUST NOT DISAGREE WITH THE PARTNER'S SCREEN. Both sides read the same
// statuses, so if this said "your installer is working on it" while the partner's
// work list said the job was on our desk, one of the two is lying to somebody who
// will eventually compare notes. A test asserts they agree, rather than a comment
// asking the next person to keep them in step.
//
// Pure, and generic over nothing — it takes two statuses and returns a view.
// ---------------------------------------------------------------------------

export type TrackingActor =
  // The customer themselves.
  | "you"
  // SOT's desk.
  | "sot"
  // The partner on site.
  | "installer";

export type TrackingStepState = "done" | "current" | "upcoming";

export type TrackingStep = {
  number: number;
  title: string;
  description: string;
  state: TrackingStepState;
};

export type OrderTracking = {
  steps: TrackingStep[];
  // Who the job is sitting with, and what to say about it. Null once there is
  // nobody left to wait for.
  waitingOn: TrackingActor | null;
  waitingLabel: string;
  finished: boolean;
  // True when the order ended without finishing. The ladder is meaningless then,
  // and drawing seven steps against a cancelled order implies it is still moving.
  stopped: boolean;
};

const WAITING_LABEL: Record<TrackingActor, string> = {
  you: "Waiting on you",
  sot: "With SOT",
  installer: "With your installer",
};

// What a customer is told to expect while a BOQ sits at each status.
//
// Keyed on the status rather than the stage, because stage 5 covers three of
// them and "assigned" and "installing" are the difference between an installer
// who is booked and one who is on site. That difference is the entire content of
// the answer for the person waiting in the building.
const WHO_HAS_IT: Record<BoqStatus, TrackingActor> = {
  draft: "you",
  validated: "sot",
  submitted: "sot",
  reviewed: "sot",
  offered: "you",
  ordered: "sot",
  assigned: "installer",
  installing: "installer",
  // Theirs is finished, ours has not started. The partner's work list calls this
  // `waiting_on_us` for the same reason, and the test holds the two together.
  installed: "sot",
  verified: "sot",
  handed_over: "sot",
};

const SAYS: Record<BoqStatus, string> = {
  draft: "Finish your design to move this on.",
  validated: "Your design has passed its checks.",
  submitted: "We are reviewing your design.",
  reviewed: "Reviewed — we are preparing your quote.",
  offered: "Your quote is ready to accept.",
  ordered: "We are assigning an installer.",
  assigned: "An installer has been assigned and will be in touch.",
  installing: "Your installer is on site.",
  installed: "Installation finished — we are verifying the work.",
  verified: "Verified. We are putting your documentation together.",
  handed_over: "Handed over. Your documentation is available.",
};

const stepsUpTo = (current: number): TrackingStep[] =>
  BOQ_STAGES.map((stage) => ({
    number: stage.number,
    title: stage.title,
    description: stage.description,
    state:
      stage.number < current
        ? "done"
        : stage.number === current
          ? "current"
          : "upcoming",
  }));

/**
 * A direct product order's ladder, which is two rungs long.
 *
 * Deliberately short. There is no delivery model — nothing in the system can
 * ever set a "shipped" or "delivered" status on a non-BOQ order — so inventing
 * those steps would draw a bar that can never fill, and a step that never
 * advances reads as a stall rather than as an absence.
 */
const directSteps = (paid: boolean): TrackingStep[] => [
  {
    number: 1,
    title: "Ordered",
    description: "Your order is placed and waiting to be settled.",
    state: paid ? "done" : "current",
  },
  {
    number: 2,
    title: "Paid",
    description: "Payment recorded against your order.",
    state: paid ? "current" : "upcoming",
  },
];

export type TrackingInput = {
  orderStatus: OrderStatus;
  // Null for a direct product order shopped from the catalogue.
  boqStatus: BoqStatus | null;
};

/**
 * Where this order has got to, and who it is waiting on.
 */
export const buildOrderTracking = ({
  orderStatus,
  boqStatus,
}: TrackingInput): OrderTracking => {
  // An order that ended gets no ladder. Seven steps drawn against a cancelled
  // order say it is still moving.
  if (orderStatus === "cancelled" || orderStatus === "refunded") {
    return {
      steps: [],
      waitingOn: null,
      waitingLabel:
        orderStatus === "cancelled"
          ? "This order was cancelled."
          : "This order was refunded.",
      finished: false,
      stopped: true,
    };
  }

  // Unpaid comes first whatever the BOQ says. The money is the thing blocking,
  // and it is blocking on the customer — which is precisely the case a step
  // count would have hidden.
  if (orderStatus === "awaiting_payment") {
    return {
      steps: boqStatus === null ? directSteps(false) : stepsUpTo(4),
      waitingOn: "you",
      waitingLabel: WAITING_LABEL.you,
      finished: false,
      stopped: false,
    };
  }

  if (boqStatus === null) {
    return {
      steps: directSteps(true),
      // Paid, and with us. Not "finished" — the customer has not received
      // anything yet, and saying so would close a job that is still open.
      waitingOn: "sot",
      waitingLabel: WAITING_LABEL.sot,
      finished: false,
      stopped: false,
    };
  }

  const stage = stageOf(boqStatus);
  const finished = boqStatus === "handed_over";

  return {
    steps: stepsUpTo(stage.number),
    waitingOn: finished ? null : WHO_HAS_IT[boqStatus],
    waitingLabel: finished ? SAYS.handed_over : WAITING_LABEL[WHO_HAS_IT[boqStatus]],
    finished,
    stopped: false,
  };
};

/** The one line explaining the current step, in the customer's words. */
export const describeStage = (boqStatus: BoqStatus | null): string =>
  boqStatus === null
    ? "We will be in touch about your order."
    : SAYS[boqStatus];
