"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { selectOffer } from "services";

export type SelectOfferResult = {
  error?: string;
};

export const chooseOffer = async (
  boqUuid: string,
  offerUuid: string,
): Promise<SelectOfferResult> => {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await selectOffer({ userUuid: user.uuid, boqUuid, offerUuid });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to select offer",
    };
  }

  revalidatePath(`/boq/${boqUuid}`);
  return {};
};
