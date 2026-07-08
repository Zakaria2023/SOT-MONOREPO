"use server";

import type { SelectPartnerRequests } from "@/db/schema/partner-requests";
import { getReviewerName, splitFullName } from "@/lib/helpers";
import { requireAdmin } from "@/lib/server/auth";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  approvePartnerRequest as approvePartnerRequestRecord,
  getPartnerRequestByUuid,
  listPartnerRequests,
  rejectPartnerRequest as rejectPartnerRequestRecord,
} from "services";
import {
  partnerApprovalSchema,
  partnerRejectionSchema,
  type PartnerApprovalInput,
  type PartnerRejectionInput,
} from "validators";

export type PartnerRequestListItem = SelectPartnerRequests;

export type PartnerReviewResult = {
  error?: string;
  success?: boolean;
};

export const getPartnerRequests = async (): Promise<PartnerRequestListItem[]> => {
  await requireAdmin();
  return listPartnerRequests();
};

export const approvePartnerRequestAction = async (
  partnerRequestUuid: string,
  input: PartnerApprovalInput,
): Promise<PartnerReviewResult> => {
  const { userId, user } = await requireAdmin();
  const parsed = partnerApprovalSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Please provide a password with at least 8 characters." };
  }

  const request = await getPartnerRequestByUuid(partnerRequestUuid);
  if (!request) {
    return { error: "Partner request not found." };
  }

  const client = await clerkClient();
  let createdClerkUserId: string | null = null;

  try {
    if (request.status !== "pending") {
      throw new Error("This partner request has already been reviewed");
    }

    const existingUsers = await client.users.getUserList({
      emailAddress: [request.email],
      limit: 1,
    });

    if (existingUsers.data.length > 0) {
      throw new Error("A Clerk user with this email already exists");
    }

    const { firstName, lastName } = splitFullName(request.fullName);
    const createdUser = await client.users.createUser({
      emailAddress: [request.email],
      password: parsed.data.password,
      firstName,
      lastName,
      publicMetadata: { role: "partner" },
      privateMetadata: { partnerRequestUuid },
    });

    createdClerkUserId = createdUser.id;

    const primaryEmailAddress = createdUser.emailAddresses[0];
    if (primaryEmailAddress) {
      await client.emailAddresses.updateEmailAddress(primaryEmailAddress.id, {
        verified: true,
        primary: true,
      });
    }

    await approvePartnerRequestRecord({
      partnerRequestUuid,
      approvedClerkUserId: createdUser.id,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });
  } catch (error) {
    if (createdClerkUserId) {
      try {
        await client.users.deleteUser(createdClerkUserId);
      } catch {
        // Leave the original error as the user-facing result.
      }
    }

    // Clerk validation failures (e.g. a weak or breached password) come back as
    // a 422 whose top-level message is just "Unprocessable Entity" — surface the
    // specific reason from the errors array instead.
    if (isClerkAPIResponseError(error)) {
      const [firstError] = error.errors;
      return {
        error:
          firstError?.longMessage ??
          firstError?.message ??
          "Failed to approve partner request.",
      };
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to approve partner request.",
    };
  }

  revalidatePath("/partners");
  return { success: true };
};

export const rejectPartnerRequestAction = async (
  partnerRequestUuid: string,
  input: PartnerRejectionInput,
): Promise<PartnerReviewResult> => {
  const { userId, user } = await requireAdmin();
  const parsed = partnerRejectionSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Please add a reject reason." };
  }

  try {
    await rejectPartnerRequestRecord({
      partnerRequestUuid,
      rejectionReason: parsed.data.rejectionReason,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to reject partner request.",
    };
  }

  revalidatePath("/partners");
  return { success: true };
};
