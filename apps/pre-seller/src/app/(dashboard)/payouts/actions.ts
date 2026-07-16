"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { markPayoutPaid } from "services";

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
    return {
      error: error instanceof Error ? error.message : "Failed to settle payout",
    };
  }
  revalidatePath("/payouts");
  return {};
};
