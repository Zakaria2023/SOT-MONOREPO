"use server";

import { requirePreSeller } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { completeHandover, disputeHandover, verifyHandover } from "services";
import { type ActionResult, fail } from "utils";

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
export const verify = async (boqUuid: string): Promise<ActionResult> => {
  const user = await requirePreSeller();
  try {
    await verifyHandover({
      boqUuid,
      sotClerkUserId: user.id,
      sotName: operatorName(user),
    });
  } catch (error) {
    return fail(error, "Failed to verify");
  }
  revalidate(boqUuid);
  return {};
};

// The escrow release — hands over and accrues/settles the partner's earning.
export const complete = async (
  boqUuid: string,
): Promise<ActionResult> => {
  await requirePreSeller();
  try {
    await completeHandover({ boqUuid });
  } catch (error) {
    return fail(error, "Failed to complete");
  }
  revalidate(boqUuid);
  return {};
};

export const dispute = async (
  boqUuid: string,
  reason: string,
): Promise<ActionResult> => {
  await requirePreSeller();
  if (!reason.trim()) {
    return { error: "Add a reason" };
  }
  try {
    await disputeHandover({ boqUuid, reason });
  } catch (error) {
    return fail(error, "Failed to dispute");
  }
  revalidate(boqUuid);
  return {};
};
