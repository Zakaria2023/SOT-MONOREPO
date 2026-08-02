"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { markPayoutPaid } from "services";
import { fail } from "utils";

export type SettleState = {
  error?: string;
};

export const settlePayout = async (
  payoutUuid: string,
): Promise<SettleState> => {
  await requirePreSeller();
  try {
    await markPayoutPaid(payoutUuid);
  } catch (error) {
    return fail(error, "Failed to settle payout");
  }
  revalidatePath("/payouts");
  return {};
};
