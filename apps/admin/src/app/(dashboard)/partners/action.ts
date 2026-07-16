"use server";

import type { SelectPartnerRequests } from "@/db/schema/partner-requests";
import { getReviewerName } from "utils";
import { requireAdmin } from "@/lib/server/auth";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { PartnerBadge } from "@/db/enum";
import {
  approvePartnerRequest as approvePartnerRequestRecord,
  getPartnerRequestByUuid,
  listPartnerRequests,
  rejectPartnerRequest as rejectPartnerRequestRecord,
  setPartnerCommercialProfile,
} from "services";
import {
  partnerRejectionSchema,
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
): Promise<PartnerReviewResult> => {
  const { userId, user } = await requireAdmin();

  const request = await getPartnerRequestByUuid(partnerRequestUuid);
  if (!request) {
    return { error: "Partner request not found." };
  }

  const client = await clerkClient();

  try {
    if (request.status !== "pending") {
      throw new Error("This partner request has already been reviewed");
    }

    // Invite the partner's email to set up their own account. The details ride
    // in publicMetadata so the webhook can build the partner Users row when
    // the invitation is accepted, and the partner app gates on the role. Only
    // the fields this applicant type filled are included.
    const metadataFields = {
      fullName: request.fullName,
      contactNumber: request.contactNumber,
      location: request.location,
      firstName: request.firstName,
      middleName: request.middleName,
      lastName: request.lastName,
      companyName: request.companyName,
      unifiedNumber: request.unifiedNumber,
      crNumber: request.crNumber,
      vatNumber: request.vatNumber,
      nationalAddress: request.nationalAddress,
      crCertificate: request.crCertificate,
      vatCertificate: request.vatCertificate,
      representativeName: request.representativeName,
    };

    const invitation = await client.invitations.createInvitation({
      emailAddress: request.email,
      ignoreExisting: true,
      publicMetadata: {
        role: "partner",
        type: "partner",
        ...Object.fromEntries(
          Object.entries(metadataFields).filter(([, value]) => value != null),
        ),
      },
    });

    await approvePartnerRequestRecord({
      partnerRequestUuid,
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

export const setPartnerCommercialAction = async (
  partnerRequestUuid: string,
  badge: PartnerBadge,
  isIntegrated: boolean,
): Promise<PartnerReviewResult> => {
  await requireAdmin();

  try {
    await setPartnerCommercialProfile({
      partnerRequestUuid,
      badge,
      isIntegrated,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update partner profile.",
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
