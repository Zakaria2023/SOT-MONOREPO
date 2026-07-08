"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { submitReviewedBoq } from "services";

export type SubmitBoqResult = {
  error?: string;
};

/**
 * Submits the reviewed BOQ and dispatches it to the 3 nearest partners, storing
 * the note the pre-seller wrote for each one (keyed by partner Clerk user id).
 */
export const submitBoq = async (
  boqUuid: string,
  comments: Record<string, string>,
): Promise<SubmitBoqResult> => {
  const user = await requirePreSeller();

  try {
    await submitReviewedBoq({ preSellerId: user.id, boqUuid, comments });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to submit BOQ",
    };
  }

  revalidatePath(`/boqs/${boqUuid}`);
  return {};
};
