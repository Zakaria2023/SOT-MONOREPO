import type { DesignFinding } from "./design-check";
import type { DesignQuestion } from "./design-questions";

// ---------------------------------------------------------------------------
// THE GUIDED BUILDER.
//
// One implementation, two surfaces: the customer building their own system and
// the partner building one for a client. They differ in who is looking, never in
// what makes a design complete — two definitions of "finished" would mean a
// partner could submit something the customer's own screen would have refused.
//
// It is engine-driven in the literal sense. Nothing here decides what to ask:
// the questions are the ones the RULES could not answer for this basket, and the
// gate is whether the same evaluator that guards checkout finds a blocker. There
// is no separate wizard rulebook to drift from the real one.
//
// AND AN UNMET CONSTRAINT IS SHOWN AS AN INCOMPLETE SYSTEM, NOT AN ERROR. "Your
// design has 3 errors" reads as "you did something wrong"; "this system still
// needs a recorder" reads as the next thing to do. The buyer is not debugging —
// they are building — and a design half-finished is the normal state of the
// screen rather than a fault in it.
//
// Pure. Given what is in the basket and what the engine said about it, the same
// state comes out every time, and every branch is testable without a database.
// ---------------------------------------------------------------------------

export type WizardStep = "choose" | "answer" | "review";

export type WizardGapKind =
  // A rule says the design cannot work as it stands.
  | "blocker"
  // A rule needs something from the buyer before it can judge.
  | "question"
  // Nothing has been chosen yet.
  | "empty";

export type WizardGap = {
  kind: WizardGapKind;
  title: string;
  detail: string;
  // The finding this came from, so a surface can scroll to it. Null for `empty`.
  findingId: string | null;
};

export type WizardState = {
  step: WizardStep;
  // Only what is still needed. A question already answered is not asked again.
  questions: DesignQuestion[];
  gaps: WizardGap[];
  // The hard gate. False while anything blocks, and false for an empty basket —
  // an empty design is not a finished one.
  canFinish: boolean;
  // 0 to 1. Deliberately NOT "steps completed / steps total": a buyer who has
  // answered everything and still has two blockers is not 90% done, and a bar
  // that says so is a bar nobody trusts twice.
  progress: number;
  // What to put on the button. Carried here so the two surfaces cannot word the
  // gate differently.
  callToAction: string;
};

export type WizardInput = {
  lineCount: number;
  blockers: DesignFinding[];
  // Checks that cleared without covering everything. They do NOT block — the
  // rule was satisfied on what it could read — but they belong in the gaps,
  // because a design nobody could fully check is not a design anybody should
  // present as finished without saying so.
  partial: DesignFinding[];
  questions: DesignQuestion[];
  // Which questions the buyer has answered, by variable uuid.
  answered: string[];
};

const gapFromFinding = (
  finding: DesignFinding,
  kind: WizardGapKind,
): WizardGap => ({
  kind,
  title: finding.title,
  detail: finding.message,
  findingId: finding.id,
});

/**
 * Where the buyer is, and what is still missing.
 *
 * The step is derived, never stored. A buyer who removes their last product is
 * back at the beginning whatever the wizard thought it was doing, and a stored
 * step would have them answering questions about an empty basket.
 */
export const wizardState = (input: WizardInput): WizardState => {
  const answered = new Set(input.answered);
  const unanswered = input.questions.filter(
    (question) => !answered.has(question.uuid),
  );

  if (input.lineCount === 0) {
    return {
      step: "choose",
      questions: [],
      gaps: [
        {
          kind: "empty",
          title: "Nothing chosen yet",
          detail: "Add the equipment this system needs and we will check it.",
          findingId: null,
        },
      ],
      canFinish: false,
      progress: 0,
      callToAction: "Choose your equipment",
    };
  }

  const canFinish = input.blockers.length === 0 && unanswered.length === 0;

  const gaps: WizardGap[] = [
    ...input.blockers.map((finding) => gapFromFinding(finding, "blocker")),
    ...unanswered.map((question) => ({
      kind: "question" as const,
      title: question.label,
      detail: "We need this before we can finish checking the design.",
      findingId: question.affects[0] ?? null,
    })),
  ];

  // A partial pass is worth saying out loud without blocking on it: what the
  // rule could read was fine, and what it could not read is our missing data,
  // not the buyer's mistake.
  for (const finding of input.partial) {
    gaps.push(gapFromFinding(finding, "question"));
  }

  // Progress measures how close this design is to being FINISHABLE, and nothing
  // else. Two consequences, both learned by watching it get them wrong:
  //
  // A partial pass does not count. It is advisory — the rule was satisfied on
  // what it could read — so counting it dragged a design that could be finished
  // down to 0%, which is the "bar nobody trusts twice" this comment used to warn
  // about while the code did it.
  //
  // And if the design can be finished, it is finished. Deriving the number
  // separately let it disagree with the button beside it.
  const demands = input.blockers.length + input.questions.length;
  const outstanding = input.blockers.length + unanswered.length;
  const progress = canFinish ? 1 : demands === 0 ? 1 : 1 - outstanding / demands;

  return {
    step: unanswered.length > 0 ? "answer" : "review",
    questions: unanswered,
    gaps,
    canFinish,
    progress: Math.max(0, Math.min(1, progress)),
    callToAction: canFinish
      ? "This design is ready"
      : input.blockers.length > 0
        ? `${input.blockers.length} thing${input.blockers.length === 1 ? "" : "s"} still to sort out`
        : `Answer ${unanswered.length} question${unanswered.length === 1 ? "" : "s"}`,
  };
};
