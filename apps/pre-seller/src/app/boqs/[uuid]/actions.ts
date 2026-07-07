"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  removeBoqItem,
  submitReviewedBoq,
  updateBoqItemQuantity,
} from "services";

export type SubmitBoqResult = {
  error?: string;
};

export const updateItemQuantity = async (
  boqUuid: string,
  boqItemUuid: string,
  quantity: number,
): Promise<void> => {
  const user = await requirePreSeller();
  await updateBoqItemQuantity({ preSellerId: user.id, boqItemUuid, quantity });
  revalidatePath(`/boqs/${boqUuid}`);
};

export const removeItem = async (
  boqUuid: string,
  boqItemUuid: string,
): Promise<void> => {
  const user = await requirePreSeller();
  await removeBoqItem({ preSellerId: user.id, boqItemUuid });
  revalidatePath(`/boqs/${boqUuid}`);
};

/** Submits the reviewed BOQ and dispatches it to the 3 nearest partners. */
export const submitBoq = async (boqUuid: string): Promise<SubmitBoqResult> => {
  const user = await requirePreSeller();

  try {
    await submitReviewedBoq({ preSellerId: user.id, boqUuid });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to submit BOQ",
    };
  }

  revalidatePath(`/boqs/${boqUuid}`);
  return {};
};
