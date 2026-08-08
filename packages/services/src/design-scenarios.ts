import { asc, eq } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import {
  DesignScenarios,
  type SelectDesignScenarios,
} from "../../../db/schema/design-scenarios";
import type {
  ProjectAnswers,
  ScenarioLine,
  ScenarioSnapshot,
} from "../../../db/types";
import { ValidationError } from "./errors";
import { traceDesign } from "./relationships";
import { diffScenario, type ScenarioDrift } from "./scenario-drift";

// Re-exported so an app never has to reach past the services package for the
// row type of something only this service reads or writes.
export type { SelectDesignScenarios };

// ---------------------------------------------------------------------------
// THE REGRESSION SUITE.
//
// The sandbox proves a rule set behaves correctly once, in front of whoever ran
// it. The next person to edit a rule cannot find out they broke that, because
// nothing kept the basket. This keeps it.
//
// A scenario is saved from a run and starts with NO baseline. Somebody has to
// look at the verdict and accept it, and until they do it is a recorded
// observation rather than an expectation. That gap is deliberate: auto-accepting
// the first run makes whatever the engine did that day the definition of
// correct, bug and all.
// ---------------------------------------------------------------------------

export type ScenarioInput = {
  name: string;
  note: string | null;
  selection: ScenarioLine[];
  variables: ProjectAnswers;
};

export type ScenarioRun = {
  scenario: SelectDesignScenarios;
  actual: ScenarioSnapshot;
  // Null when the scenario has never been baselined — there is nothing to differ
  // FROM, which is not the same as nothing differing.
  drift: ScenarioDrift | null;
};

export const listScenarios = async (): Promise<SelectDesignScenarios[]> =>
  db.select().from(DesignScenarios).orderBy(asc(DesignScenarios.name));

export const getScenario = async (
  uuid: string,
): Promise<SelectDesignScenarios | null> => {
  const [row] = await db
    .select()
    .from(DesignScenarios)
    .where(eq(DesignScenarios.uuid, uuid));
  return row ?? null;
};

const assertUsable = (input: ScenarioInput): void => {
  if (input.name.trim() === "") {
    throw new ValidationError("A scenario needs a name.");
  }
  const lines = input.selection.filter((line) => line.quantity > 0);
  if (lines.length === 0) {
    throw new ValidationError(
      "A scenario needs at least one product in its basket.",
    );
  }
};

export const createScenario = async (input: ScenarioInput): Promise<string> => {
  assertUsable(input);
  const uuid = generateUuid();
  await db.insert(DesignScenarios).values({
    uuid,
    name: input.name.trim(),
    note: input.note?.trim() || null,
    selection: input.selection.filter((line) => line.quantity > 0),
    variables: input.variables,
    expected: null,
  });
  return uuid;
};

export const deleteScenario = async (uuid: string): Promise<void> => {
  await db.delete(DesignScenarios).where(eq(DesignScenarios.uuid, uuid));
};

/**
 * Run one scenario and compare it to its baseline.
 *
 * Built from `traceDesign` rather than `checkDesign`, because a scenario has to
 * cover the rules that said NOTHING. A rule sliding from `block` to
 * `not_applicable` is the most dangerous regression there is — the gate opens
 * and nothing appears anywhere to say so — and the buyer's shape cannot see it.
 */
export const runScenario = async (uuid: string): Promise<ScenarioRun | null> => {
  const scenario = await getScenario(uuid);
  if (!scenario) {
    return null;
  }

  const traced = await traceDesign(scenario.selection, scenario.variables);
  const actual: ScenarioSnapshot = {
    rules: traced.map((entry) => ({
      relationshipUuid: entry.finding.relationshipUuid,
      name: entry.finding.name,
      status: entry.finding.status,
      skippedProductUuids: entry.finding.skipped.map(
        (item) => item.productUuid,
      ),
    })),
  };

  return {
    scenario,
    actual,
    drift: scenario.expected ? diffScenario(scenario.expected, actual) : null,
  };
};

/**
 * Every scenario, run.
 *
 * Sequential on purpose. Each run loads the selection and evaluates the whole
 * rule set, and firing twenty of those at a shared database with a hard
 * connection ceiling to save a few seconds on an admin screen is the wrong
 * trade. The model itself is cached across them.
 */
export const runAllScenarios = async (): Promise<ScenarioRun[]> => {
  const scenarios = await listScenarios();
  const runs: ScenarioRun[] = [];
  for (const scenario of scenarios) {
    const run = await runScenario(scenario.uuid);
    if (run) {
      runs.push(run);
    }
  }
  return runs;
};

/**
 * Accept what the scenario says today as what it should say.
 *
 * The only way a baseline is ever written. There is no path that records one as
 * a side effect of running, because a suite that re-baselines itself reports
 * green forever and protects nothing.
 */
export const baselineScenario = async (
  uuid: string,
  actor: { name: string },
): Promise<void> => {
  const run = await runScenario(uuid);
  if (!run) {
    throw new ValidationError("That scenario no longer exists.");
  }
  await db
    .update(DesignScenarios)
    .set({
      expected: run.actual,
      baselinedBy: actor.name,
      baselinedAt: new Date(),
    })
    .where(eq(DesignScenarios.uuid, uuid));
};
