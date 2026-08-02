"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { markPayoutPaid } from "services";
import { type ActionResult, fail } from "utils";

export const settlePayout = async (
  payoutUuid: string,
): Promise<ActionResult> => {
  await requirePreSeller();
  try {
    await markPayoutPaid(payoutUuid);
  } catch (error) {
    return fail(error, "Failed to settle payout");
  }
  revalidatePath("/payouts");
  return {};
};
