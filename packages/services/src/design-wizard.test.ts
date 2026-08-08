import { describe, expect, it } from "vitest";
import type { DesignFinding } from "./design-check";
import type { DesignQuestion } from "./design-questions";
import { wizardState, type WizardInput } from "./design-wizard";

const blocker = (id: string, title = "Over PoE budget"): DesignFinding => ({
  id,
  title,
  message: "The switch cannot power everything on it.",
  family: "budget",
  tone: "block",
  corrections: [],
  failingProductUuids: [],
  skipped: [],
});

const question = (uuid: string, label = "How many cameras?"): DesignQuestion => ({
  uuid,
  label,
  unit: null,
  kind: "magnitude",
  value: null,
  affects: ["budget:r1"],
});

const input = (over: Partial<WizardInput> = {}): WizardInput => ({
  lineCount: 3,
  blockers: [],
  partial: [],
  questions: [],
  answered: [],
  ...over,
});

describe("an empty basket", () => {
  it("is at the start, whatever else is true", () => {
    // The step is derived, never stored: removing the last product puts the
    // buyer back at the beginning rather than answering questions about nothing.
    const state = wizardState(
      input({ lineCount: 0, questions: [question("v1")] }),
    );
    expect(state.step).toBe("choose");
    expect(state.questions).toEqual([]);
    expect(state.progress).toBe(0);
  });

  it("cannot be finished", () => {
    // An empty design is not a finished one.
    expect(wizardState(input({ lineCount: 0 })).canFinish).toBe(false);
  });

  it("says what to do rather than what is wrong", () => {
    const [gap] = wizardState(input({ lineCount: 0 })).gaps;
    expect(gap.kind).toBe("empty");
    expect(gap.detail).toContain("Add the equipment");
  });
});

describe("the hard completion gate", () => {
  it("refuses to finish while a rule blocks", () => {
    const state = wizardState(input({ blockers: [blocker("b1")] }));
    expect(state.canFinish).toBe(false);
    expect(state.callToAction).toContain("1 thing");
  });

  it("refuses to finish while a question is unanswered", () => {
    const state = wizardState(input({ questions: [question("v1")] }));
    expect(state.canFinish).toBe(false);
    expect(state.step).toBe("answer");
  });

  it("allows it once nothing blocks and nothing is unanswered", () => {
    const state = wizardState(
      input({ questions: [question("v1")], answered: ["v1"] }),
    );
    expect(state.canFinish).toBe(true);
    expect(state.step).toBe("review");
    expect(state.callToAction).toBe("This design is ready");
  });

  it("does NOT block on a partial pass", () => {
    // What the rule could read was fine. What it could not read is our missing
    // data, not the buyer's mistake — so it is said out loud without gating.
    const state = wizardState(input({ partial: [blocker("p1")] }));
    expect(state.canFinish).toBe(true);
    expect(state.gaps).toHaveLength(1);
  });
});

describe("gaps read as an incomplete system, not an error list", () => {
  it("carries the finding id so a surface can point at it", () => {
    const [gap] = wizardState(input({ blockers: [blocker("b1")] })).gaps;
    expect(gap.findingId).toBe("b1");
  });

  it("uses the question's own label as the gap title", () => {
    const state = wizardState(
      input({ questions: [question("v1", "How many floors?")] }),
    );
    expect(state.gaps[0].title).toBe("How many floors?");
    expect(state.gaps[0].kind).toBe("question");
  });

  it("drops a question once it is answered", () => {
    const state = wizardState(
      input({
        questions: [question("v1"), question("v2", "Cloud recording?")],
        answered: ["v1"],
      }),
    );
    expect(state.questions.map((q) => q.uuid)).toEqual(["v2"]);
    expect(state.gaps).toHaveLength(1);
  });
});

describe("progress", () => {
  it("is 1 when the design demands nothing", () => {
    expect(wizardState(input()).progress).toBe(1);
  });

  it("is held back by a blocker even when every question is answered", () => {
    // A buyer with two blockers and a full questionnaire is not 90% done, and a
    // bar that says so is a bar nobody trusts twice.
    const state = wizardState(
      input({
        blockers: [blocker("b1"), blocker("b2")],
        questions: [question("v1")],
        answered: ["v1"],
      }),
    );
    expect(state.canFinish).toBe(false);
    expect(state.progress).toBeLessThan(0.5);
  });

  it("rises as questions are answered", () => {
    const two = wizardState(
      input({ questions: [question("v1"), question("v2")] }),
    );
    const one = wizardState(
      input({ questions: [question("v1"), question("v2")], answered: ["v1"] }),
    );
    expect(one.progress).toBeGreaterThan(two.progress);
  });

  it("is full whenever the design can be finished", () => {
    // Caught by driving it: a partial pass counted against progress while not
    // blocking, so a finishable design showed 0% beside a button saying it was
    // ready. A bar that disagrees with the button is worse than no bar.
    const state = wizardState(input({ partial: [blocker("p1")] }));
    expect(state.canFinish).toBe(true);
    expect(state.progress).toBe(1);
  });

  it("never leaves 0..1", () => {
    const state = wizardState(
      input({
        blockers: [blocker("b1"), blocker("b2"), blocker("b3")],
        partial: [blocker("p1")],
        questions: [question("v1")],
      }),
    );
    expect(state.progress).toBeGreaterThanOrEqual(0);
    expect(state.progress).toBeLessThanOrEqual(1);
  });
});

describe("one definition of finished, for both surfaces", () => {
  it("gives the same answer whoever is asking", () => {
    // The partner surface and the customer surface call this same function, so a
    // partner cannot submit something the customer's own screen would refuse.
    const shared = input({ blockers: [blocker("b1")] });
    expect(wizardState(shared)).toEqual(wizardState(shared));
    expect(wizardState(shared).canFinish).toBe(false);
  });
});
