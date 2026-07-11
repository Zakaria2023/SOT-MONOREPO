"use server";

import { getReviewerName } from "utils";
import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  approveOffer,
  listOffers,
  rejectOffer,
  type OfferListItem,
} from "services";
import { offerRejectionSchema, type OfferRejectionInput } from "validators";

export type OfferRow = OfferListItem;

export type OfferReviewResult = {
  error?: string;
  success?: boolean;
};

export const getOffers = async (): Promise<OfferRow[]> => {
  await requireAdmin();
  return listOffers();
};

export const approveOfferAction = async (
  offerUuid: string,
): Promise<OfferReviewResult> => {
  const { userId, user } = await requireAdmin();

  try {
    await approveOffer({
      offerUuid,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to approve offer.",
    };
  }

  revalidatePath("/offers");
  return { success: true };
};

export const rejectOfferAction = async (
  offerUuid: string,
  input: OfferRejectionInput,
): Promise<OfferReviewResult> => {
  const { userId, user } = await requireAdmin();

  const parsed = offerRejectionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please add a reject reason." };
  }

  try {
    await rejectOffer({
      offerUuid,
      rejectionReason: parsed.data.rejectionReason,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to reject offer.",
    };
  }

  revalidatePath("/offers");
  return { success: true };
};
