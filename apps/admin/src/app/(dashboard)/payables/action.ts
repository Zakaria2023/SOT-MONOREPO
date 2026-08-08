"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  listPartnerPayables,
  listPayableQueue,
  markPayoutPaid,
  type PartnerPayable,
  type SelectPartnerPayouts,
} from "services";
import { fail, type ActionResult } from "utils";

// A10. Every action here is one side of a ledger — what is owed, and what has
// been transferred. Nothing in this file can reach revenue or margin; that is
// A11, and the separation is asserted by a test rather than left to care.

export const getPayablesAction = async (): Promise<PartnerPayable[]> => {
  await requireAdmin();
  return listPartnerPayables();
};

export const getPayableQueueAction = async (): Promise<
  SelectPartnerPayouts[]
> => {
  await requireAdmin();
  return listPayableQueue();
};

/**
 * Record that the transfer happened.
 *
 * Recording, not performing: the money moves through a bank, and this is the
 * ledger catching up with it. Which is why it takes a reference — an entry
 * saying "paid" with nothing to check it against is unauditable.
 */
export const markPayoutPaidAction = async (
  uuid: string,
  reference: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    if (reference.trim() === "") {
      return { error: "A transfer needs a reference." };
    }
    await markPayoutPaid(uuid, { reference: reference.trim(), by: actor.name });
    revalidatePath("/payables");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record that payment");
  }
};
