import {
  ruleVariables,
  type EngineRelationship,
  type EngineVariable,
  type Finding,
  type VariableAsk,
} from "./relationship-engine";

// ---------------------------------------------------------------------------
// Which project questions are worth asking about a basket.
//
// Pure and free of any database import, like the engine it reads from, so the
// choice of what to ask can be tested directly — the surfaces that ASK live in
// the apps, and `checkDesign` is what joins the two.
// ---------------------------------------------------------------------------

// A project question this basket needs answered — and only this basket. The
// library may hold a dozen project inputs; asking a buyer with three cameras in
// the cart about PBX capacity teaches them to skip the whole block.
export type DesignQuestion = {
  uuid: string;
  label: string;
  unit: string | null;
  // What kind of answer clears it, taken from how the rule USES the input rather
  // than from its declared type — see VariableAsk.
  kind: VariableAsk["kind"];
  // The answer in force for the check just run: the buyer's, or the authored
  // default when they have not answered. Null when there is neither, which is
  // exactly when the rule could not run.
  value: number | boolean | null;
  // Finding ids that hinge on it, so the UI can put the question beside the
  // finding it clears instead of in a block of its own.
  affects: string[];
};

/**
 * The questions worth asking about THIS basket.
 *
 * Derived from the findings, not from the library: a question is asked only when
 * a rule that engaged with the selection reads the input AND the answer in force
 * would change its verdict. So a rule that passed asks nothing, a rule nothing in
 * the cart participates in asks nothing, and a rule that could not run because
 * PRODUCT data is missing asks nothing either — that one is our gap to fix, not
 * the buyer's.
 *
 * A magnitude is asked when there is no number to use. A toggle is asked whenever
 * it is not already yes, including when it is explicitly no: "recording is in the
 * cloud" defaulting to no is not the buyer saying so, and the alternative it
 * would excuse is the difference between a blocked cart and a fine one.
 */
export const pendingQuestions = (
  findings: Finding[],
  rules: EngineRelationship[],
  variables: Map<string, EngineVariable>,
): DesignQuestion[] => {
  const byUuid = new Map(rules.map((rule) => [rule.uuid, rule]));
  const questions = new Map<string, DesignQuestion>();

  for (const finding of findings) {
    if (
      finding.status !== "block" &&
      finding.status !== "warn" &&
      finding.status !== "unknown"
    ) {
      continue;
    }
    const rule = byUuid.get(finding.relationshipUuid);
    if (!rule) {
      continue;
    }
    for (const ask of ruleVariables(rule)) {
      const variable = variables.get(ask.variableUuid);
      // A rule pointing at a deleted input cannot be asked about — there is no
      // label to put on the field. The finding still reports it, in its own words.
      if (!variable) {
        continue;
      }
      const answered =
        ask.kind === "toggle"
          ? variable.value === true
          : typeof variable.value === "number";
      if (answered) {
        continue;
      }
      const id = `${finding.family}:${finding.relationshipUuid}`;
      const existing = questions.get(variable.uuid);
      if (existing) {
        existing.affects.push(id);
        continue;
      }
      questions.set(variable.uuid, {
        uuid: variable.uuid,
        label: variable.label,
        unit: variable.unit,
        kind: ask.kind,
        value: variable.value,
        affects: [id],
      });
    }
  }

  return [...questions.values()];
};
