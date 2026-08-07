"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  baselineScenario,
  checkDesign,
  createScenario,
  deleteScenario,
  getRuleReachability,
  listScenarios,
  runAllScenarios,
  searchProductsForPicker,
  traceDesign,
} from "services";
import type {
  DesignCheckResult,
  ProductPickerItem,
  RuleReach,
  ScenarioInput,
  ScenarioRun,
  SelectDesignScenarios,
  SelectionLine,
  TracedRule,
} from "services";
import type { ProjectAnswers } from "@/db/types";
import { fail, type ActionResult } from "utils";

/**
 * The picker behind the sandbox basket.
 *
 * Its own thin action rather than a reach into the assignments folder: a route
 * folder owning its actions is the convention here, and both of these are four
 * lines around the same service function.
 */
export const searchProductsAction = async (
  search: string,
): Promise<ProductPickerItem[]> => {
  await requireAdmin();
  if (search.trim().length < 2) {
    return [];
  }
  try {
    return await searchProductsForPicker(search);
  } catch {
    return [];
  }
};

/**
 * Run every published rule over a basket the author invented.
 *
 * `checkDesign` — the same function the cart calls and the same one order
 * creation calls again before it will write. Not a rehearsal of the gate: it IS
 * the gate, pointed at a basket nobody is buying.
 *
 * This is what the single-rule preview cannot show. A rule read on its own looks
 * fine; the question that matters is what SEVEN of them say about one basket at
 * once, because that is the sentence a buyer actually gets.
 */
export const runDesignCheckAction = async (
  selection: SelectionLine[],
  variables: ProjectAnswers = {},
): Promise<{ result?: DesignCheckResult; error?: string }> => {
  await requireAdmin();
  try {
    return { result: await checkDesign({ selection, variables }) };
  } catch (error) {
    return fail(error, "Failed to run the check");
  }
};

/**
 * Why each rule can or cannot fire.
 *
 * The sandbox answers "what happens to THIS basket". This answers the question
 * a basket can never answer: a rule that engages with nothing looks identical to
 * a rule that passed, and only a static read of the catalogue can tell them
 * apart — or say whose problem it is.
 */
export const getRuleReachabilityAction = async (): Promise<RuleReach[]> => {
  await requireAdmin();
  return getRuleReachability();
};

/**
 * Every rule's verdict on this basket, including the ones that said nothing.
 *
 * Its own action, fetched only when asked for, rather than folded into the run
 * above. The buyer's answer is the common case and it stays cheap; the trace
 * evaluates the whole rule set a second time, which is worth it only when
 * somebody is actually reading it.
 */
export const traceDesignAction = async (
  selection: SelectionLine[],
  variables: ProjectAnswers = {},
): Promise<{ trace?: TracedRule[]; error?: string }> => {
  await requireAdmin();
  try {
    return { trace: await traceDesign(selection, variables) };
  } catch (error) {
    return fail(error, "Failed to trace the rules");
  }
};

// ---------------------------------------------------------------------------
// The regression suite
// ---------------------------------------------------------------------------

/**
 * Keep this basket, so the next person to edit a rule finds out they broke it.
 *
 * Saved WITHOUT a baseline. The verdict it produced today is recorded when
 * somebody accepts it, not when it is stored — a suite that adopts its first run
 * as the expectation has enshrined whatever the engine did that day, bug and all.
 */
export const saveScenarioAction = async (
  input: ScenarioInput,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await createScenario(input);
    revalidatePath("/sandbox");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to save the scenario");
  }
};

export const runAllScenariosAction = async (): Promise<ScenarioRun[]> => {
  await requireAdmin();
  return runAllScenarios();
};

/** Accept what this scenario says today as what it should say. */
export const baselineScenarioAction = async (
  uuid: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await baselineScenario(uuid, actor);
    revalidatePath("/sandbox");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to accept this verdict");
  }
};

export const deleteScenarioAction = async (
  uuid: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await deleteScenario(uuid);
    revalidatePath("/sandbox");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to delete the scenario");
  }
};

/** The saved scenarios, without running any of them. */
export const listScenariosAction = async (): Promise<
  SelectDesignScenarios[]
> => {
  await requireAdmin();
  return listScenarios();
};
