"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  advanceBoqFulfilment,
  createOrUpdateOffer,
  getPartnerBoq,
} from "services";
import type { BoqStatus } from "@/db/enum";
import { offerSchema, type OfferInput } from "validators";
import { fail } from "utils";

export type OfferActionState = {
  error?: string;
  success?: boolean;
};

export type StageActionState = {
  error?: string;
};

// Step the BOQ one fulfilment stage forward (assigned → installing →
// installed). Guarded so a partner can only advance a BOQ dispatched to them.
export const advanceStage = async (
  boqUuid: string,
  next: BoqStatus,
): Promise<StageActionState> => {
  const user = await requirePartner();

  const detail = await getPartnerBoq(user.id, boqUuid);
  if (!detail) {
    return { error: "This BOQ wasn't dispatched to you" };
  }

  try {
    await advanceBoqFulfilment(boqUuid, next);
  } catch (error) {
    return fail(error, "Failed to update stage");
  }

  revalidatePath(`/boqs/${boqUuid}`);
  return {};
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
    return fail(error, "Failed to submit offer.");
  }

  revalidatePath(`/boqs/${boqUuid}`);
  return { success: true };
};
