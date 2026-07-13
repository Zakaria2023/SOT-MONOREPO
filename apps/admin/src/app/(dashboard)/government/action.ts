"use server";

import type { SelectGovernmentRequests } from "@/db/schema/government-requests";
import { requireAdmin } from "@/lib/server/auth";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { clerkClient } from "@clerk/nextjs/server";
import { getReviewerName } from "utils";
import { revalidatePath } from "next/cache";
import {
  approveGovernmentRequest as approveGovernmentRequestRecord,
  getGovernmentRequestByUuid,
  listGovernmentRequests,
  rejectGovernmentRequest as rejectGovernmentRequestRecord,
} from "services";
import {
  governmentRejectionSchema,
  type GovernmentRejectionInput,
} from "validators";

export type GovernmentRequestListItem = SelectGovernmentRequests;

export type GovernmentReviewResult = {
  error?: string;
  success?: boolean;
};

export const getGovernmentRequests = async (): Promise<
  GovernmentRequestListItem[]
> => {
  await requireAdmin();
  return listGovernmentRequests();
};

export const approveGovernmentRequestAction = async (
  governmentRequestUuid: string,
): Promise<GovernmentReviewResult> => {
  const { userId, user } = await requireAdmin();

  const request = await getGovernmentRequestByUuid(governmentRequestUuid);
  if (!request) {
    return { error: "Government request not found." };
  }

  const client = await clerkClient();

  try {
    if (request.status !== "pending") {
      throw new Error("This government request has already been reviewed");
    }

    // Invite the official email to set up their account. The entity details
    // ride in publicMetadata so the webhook can build the government Users row
    // when the invitation is accepted.
    const invitation = await client.invitations.createInvitation({
      emailAddress: request.officialEmail,
      ignoreExisting: true,
      publicMetadata: {
        role: "user",
        type: "government",
        entityName: request.entityName,
        contactNumber: request.contactNumber,
      },
    });

    await approveGovernmentRequestRecord({
      governmentRequestUuid,
      approvedClerkUserId: invitation.id,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });
  } catch (error) {
    if (isClerkAPIResponseError(error)) {
      const [firstError] = error.errors;
      return {
        error:
          firstError?.longMessage ??
          firstError?.message ??
          "Failed to approve government request.",
      };
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to approve government request.",
    };
  }

  revalidatePath("/government");
  return { success: true };
};

export const rejectGovernmentRequestAction = async (
  governmentRequestUuid: string,
  input: GovernmentRejectionInput,
): Promise<GovernmentReviewResult> => {
  const { userId, user } = await requireAdmin();
  const parsed = governmentRejectionSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Please add a reject reason." };
  }

  try {
    await rejectGovernmentRequestRecord({
      governmentRequestUuid,
      rejectionReason: parsed.data.rejectionReason,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to reject government request.",
    };
  }

  revalidatePath("/government");
  return { success: true };
};
