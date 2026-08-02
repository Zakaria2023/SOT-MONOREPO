"use server";

import type { SelectPartnerRequests } from "@/db/schema/partner-requests";
import type { PaginatedResult } from "utils";
import { getReviewerName, paginate } from "utils";
import { requireAdmin } from "@/lib/server/auth";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  approvePartnerRequest as approvePartnerRequestRecord,
  getPartnerRequestByUuid,
  listPartnerRequests,
  rejectPartnerRequest as rejectPartnerRequestRecord,
  setPartnerIntegration,
} from "services";
import { partnerRejectionSchema, type PartnerRejectionInput } from "validators";

export type PartnerRequestListItem = SelectPartnerRequests;

export type PartnerReviewResult = {
  error?: string;
  success?: boolean;
};

export type PartnerRequestListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

// Searched + paginated page of partner requests for the list table. The
// frontend drives `search`/`page` through URL search params.
export const getPartnerRequestsPage = async (
  params: PartnerRequestListParams = {},
): Promise<PaginatedResult<PartnerRequestListItem>> => {
  await requireAdmin();
  return paginate(params, ({ limit, offset }) =>
    listPartnerRequests({ search: params.search, limit, offset }),
  );
};

export const approvePartnerRequestAction = async (
  partnerRequestUuid: string,
  isIntegrated: boolean,
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

    const publicMetadata = {
      role: "partner",
      type: "partner",
      ...Object.fromEntries(
        Object.entries(metadataFields).filter(([, value]) => value != null),
      ),
    };

    // If a Clerk account with this email already exists (e.g. the partner
    // signed up as a customer first), an invitation would never apply this
    // metadata — invitations only seed brand-new signups, so the account would
    // keep role=undefined and be bounced by the partner app's role gate. So set
    // the partner role directly on the existing user; otherwise invite them.
    const { data: existingUsers } = await client.users.getUserList({
      emailAddress: [request.email],
    });
    const [existingUser] = existingUsers;

    let approvedClerkUserId: string;
    if (existingUser) {
      await client.users.updateUserMetadata(existingUser.id, {
        publicMetadata: { ...existingUser.publicMetadata, ...publicMetadata },
      });
      approvedClerkUserId = existingUser.id;
    } else {
      const invitation = await client.invitations.createInvitation({
        emailAddress: request.email,
        ignoreExisting: true,
        publicMetadata,
      });
      approvedClerkUserId = invitation.id;
    }

    await approvePartnerRequestRecord({
      partnerRequestUuid,
      approvedClerkUserId,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });

    // Set whether the partner is integrated (chosen at approval).
    await setPartnerIntegration({ partnerRequestUuid, isIntegrated });
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

// Edit an already-approved partner's integration setting.
export const setPartnerIntegrationAction = async (
  partnerRequestUuid: string,
  isIntegrated: boolean,
): Promise<PartnerReviewResult> => {
  await requireAdmin();

  try {
    await setPartnerIntegration({ partnerRequestUuid, isIntegrated });
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
