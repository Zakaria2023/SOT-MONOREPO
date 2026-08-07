"use server";

import { requireAdmin } from "@/lib/server/auth";
import {
  checkDesign,
  getRuleReachability,
  searchProductsForPicker,
  traceDesign,
} from "services";
import type {
  DesignCheckResult,
  ProductPickerItem,
  RuleReach,
  SelectionLine,
  TracedRule,
} from "services";
import type { ProjectAnswers } from "@/db/types";
import { fail } from "utils";

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
