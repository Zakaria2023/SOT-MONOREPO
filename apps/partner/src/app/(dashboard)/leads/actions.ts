"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  acceptLeadOffer,
  declineLeadOffer,
  listPartnerOffers,
  type LeadOfferRow,
} from "services";
import { fail, type ActionResult } from "utils";

/**
 * A partner's own feed.
 *
 * The contact details come back NULL on anything they have not accepted — the
 * service withholds them, not this action. A partner deciding whether to take a job
 * needs the system, the size and the city; handing over the customer's phone number
 * at the offer stage means a lead can be worked without ever being accepted, which
 * loses SOT the record of who did what and loses the customer any accountability.
 */
export const getMyLeadsAction = async (): Promise<LeadOfferRow[]> => {
  const user = await requirePartner();
  return listPartnerOffers(user.id);
};

export const acceptLeadAction = async (
  offerUuid: string,
): Promise<ActionResult> => {
  const user = await requirePartner();
  try {
    await acceptLeadOffer({ offerUuid, partnerClerkUserId: user.id });
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to accept that lead");
  }
};

export const declineLeadAction = async (
  offerUuid: string,
  reason: string,
): Promise<ActionResult> => {
  const user = await requirePartner();
  try {
    await declineLeadOffer({
      offerUuid,
      partnerClerkUserId: user.id,
      reason,
    });
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to pass on that lead");
  }
};
