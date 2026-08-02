"use server";

import { requireAdmin } from "@/lib/server/auth";
import { adminListPage } from "@/lib/server/list";
import { revalidatePath } from "next/cache";
import { approveOffer, listOffers, OfferListItem, rejectOffer } from "services";
import {
  ActionResult,
  fail,
  getReviewerName,
  ListParams,
  PaginatedResult,
} from "utils";
import { OfferRejectionInput, offerRejectionSchema } from "validators";

export type OfferRow = OfferListItem;

export const getOffersPage = async (
  params: ListParams = {},
): Promise<PaginatedResult<OfferRow>> => adminListPage(params, listOffers);

export const approveOfferAction = async (
  offerUuid: string,
): Promise<ActionResult> => {
  const { userId, user } = await requireAdmin();

  try {
    await approveOffer({
      offerUuid,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });
  } catch (error) {
    return fail(error, "Failed to approve offer.");
  }

  revalidatePath("/offers");
  return { success: true };
};

export const rejectOfferAction = async (
  offerUuid: string,
  input: OfferRejectionInput,
): Promise<ActionResult> => {
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
    return fail(error, "Failed to reject offer.");
  }

  revalidatePath("/offers");
  return { success: true };
};
