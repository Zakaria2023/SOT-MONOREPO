"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { createOrUpdateOffer } from "services";
import { offerSchema, type OfferInput } from "validators";

export type OfferActionState = {
  error?: string;
  success?: boolean;
};

export const submitOffer = async (
  boqUuid: string,
  _prevState: OfferActionState,
  input: OfferInput,
): Promise<OfferActionState> => {
  const user = await requirePartner();

  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the form and try again." };
  }

  try {
    await createOrUpdateOffer({
      partnerClerkUserId: user.id,
      boqUuid,
      productPrice: parsed.data.productPrice,
      installPrice: parsed.data.installPrice,
      programmingPrice: parsed.data.programmingPrice || undefined,
      description: parsed.data.description,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to submit offer.",
    };
  }

  revalidatePath(`/boqs/${boqUuid}`);
  return { success: true };
};
