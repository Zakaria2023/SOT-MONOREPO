"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { submitReviewedBoq } from "services";

export type SubmitBoqResult = {
  error?: string;
};

/**
 * Submits the reviewed BOQ and dispatches it to the partners the pre-seller
 * selected (same-city matches plus any hand-picked ones), storing the note
 * written for each one (keyed by partner Clerk user id).
 */
export const submitBoq = async (
  boqUuid: string,
  partnerClerkUserIds: string[],
  comments: Record<string, string>,
): Promise<SubmitBoqResult> => {
  const user = await requirePreSeller();

  try {
    await submitReviewedBoq({
      preSellerId: user.id,
      boqUuid,
      partnerClerkUserIds,
      comments,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to submit BOQ",
    };
  }

  revalidatePath(`/boqs/${boqUuid}`);
  return {};
};
