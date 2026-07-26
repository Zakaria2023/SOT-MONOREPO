"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { completeHandover, disputeHandover, verifyHandover } from "services";

export type HandoverReviewState = {
  error?: string;
};

const revalidate = (boqUuid: string) => {
  revalidatePath("/handovers");
  revalidatePath(`/handovers/${boqUuid}`);
};

const operatorName = (
  user: Awaited<ReturnType<typeof requirePreSeller>>,
): string | undefined => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : undefined;
};

// SOT remote completeness check — moves the pack to verified.
export const verify = async (
  boqUuid: string,
): Promise<HandoverReviewState> => {
  const user = await requirePreSeller();
  try {
    await verifyHandover({
      boqUuid,
      sotClerkUserId: user.id,
      sotName: operatorName(user),
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to verify",
    };
  }
  revalidate(boqUuid);
  return {};
};

// The escrow release — hands over and accrues/settles the partner's earning.
export const complete = async (
  boqUuid: string,
): Promise<HandoverReviewState> => {
  await requirePreSeller();
  try {
    await completeHandover({ boqUuid });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to complete",
    };
  }
  revalidate(boqUuid);
  return {};
};

export const dispute = async (
  boqUuid: string,
  reason: string,
): Promise<HandoverReviewState> => {
  await requirePreSeller();
  if (!reason.trim()) {
    return { error: "Add a reason" };
  }
  try {
    await disputeHandover({ boqUuid, reason });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to dispute",
    };
  }
  revalidate(boqUuid);
  return {};
};
