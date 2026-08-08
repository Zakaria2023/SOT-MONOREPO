import { checkDesign, type DesignCheckInput } from "./design-check";
import { wizardState, type WizardState } from "./design-wizard";

// The read half. Kept apart from the state machine so every branch of the gate
// is testable without a database — the interesting cases are baskets the
// catalogue does not happen to contain today.

export type RunWizardInput = DesignCheckInput & {
  // Which questions the buyer has already answered, by variable uuid. Derived
  // from the answers themselves rather than tracked separately: an answer that
  // exists IS the question being answered, and two records of the same fact
  // drift.
  answered?: string[];
};

/**
 * Where this design stands, according to the same evaluator that guards
 * checkout.
 *
 * There is no second rulebook. A wizard with its own idea of "complete" is one
 * that eventually waves through a design the gate refuses, and the buyer finds
 * out at the last screen.
 */
export const runWizard = async (
  input: RunWizardInput,
): Promise<{ state: WizardState; degraded: boolean }> => {
  const check = await checkDesign(input);

  return {
    state: wizardState({
      lineCount: input.selection.filter((line) => line.quantity > 0).length,
      blockers: check.blockers,
      partial: check.partial,
      questions: check.questions,
      answered: input.answered ?? Object.keys(input.variables ?? {}),
    }),
    // Carried, never hidden. A design the engine could not check must not be
    // presented as one that passed — the same reason checkDesign has the flag.
    degraded: check.degraded,
  };
};
