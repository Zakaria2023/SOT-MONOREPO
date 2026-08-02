"use server";

import type { ActionResult, ListParams, PaginatedResult } from "utils";
import { fail, getReviewerName } from "utils";
import { requireAdmin } from "@/lib/server/auth";
import { adminListPage } from "@/lib/server/list";
import { revalidatePath } from "next/cache";
import {
  approveOffer,
  listOffers,
  rejectOffer,
  type OfferListItem,
} from "services";
import { offerRejectionSchema, type OfferRejectionInput } from "validators";

export type OfferRow = OfferListItem;

// Searched + paginated page of offers for the list table. The frontend drives
// `search`/`page` through URL search params.
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
