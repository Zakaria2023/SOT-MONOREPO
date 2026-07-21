"use server";

import type { PaginatedResult } from "utils";
import { getReviewerName, paginate } from "utils";
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

export type OfferListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

// Searched + paginated page of offers for the list table. The frontend drives
// `search`/`page` through URL search params.
export const getOffersPage = async (
  params: OfferListParams = {},
): Promise<PaginatedResult<OfferRow>> => {
  await requireAdmin();
  return paginate(params, ({ limit, offset }) =>
    listOffers({ search: params.search, limit, offset }),
  );
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
