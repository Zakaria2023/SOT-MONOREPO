"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { markPayoutPaid } from "services";
import { type ActionResult, fail } from "utils";

export const settlePayout = async (
  payoutUuid: string,
  // The bank's reference for the transfer. Required now: a payout marked paid
  // that cannot be matched to a statement is an assertion, not a record.
  reference: string,
): Promise<ActionResult> => {
  const user = await requirePreSeller();
  // Never blank: a transfer recorded against nobody is one nobody can be asked
  // about. Mirrors how requireAdmin names an actor.
  const by =
    user.fullName ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    "Unknown";
  try {
    await markPayoutPaid(payoutUuid, { reference, by });
  } catch (error) {
    return fail(error, "Failed to settle payout");
  }
  revalidatePath("/payouts");
  return {};
};
