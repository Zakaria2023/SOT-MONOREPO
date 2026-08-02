"use server";

import type { SelectPartnerRequests } from "@/db/schema/partner-requests";
import type { ActionResult, ListParams, PaginatedResult } from "utils";
import { fail, getReviewerName } from "utils";
import { requireAdmin } from "@/lib/server/auth";
import { inviteOrAttachClerkUser } from "@/lib/server/clerk";
import { failClerk } from "@/lib/server/clerk-error";
import { adminListPage } from "@/lib/server/list";
import { revalidatePath } from "next/cache";
import {
  approvePartnerRequest as approvePartnerRequestRecord,
  getPartnerRequestByUuid,
  listPartnerRequests,
  rejectPartnerRequest as rejectPartnerRequestRecord,
  setPartnerIntegration,
} from "services";
import { partnerRejectionSchema, type PartnerRejectionInput } from "validators";

// Searched + paginated page of partner requests for the list table. The
// frontend drives `search`/`page` through URL search params.
export const getPartnerRequestsPage = async (
  params: ListParams = {},
): Promise<PaginatedResult<SelectPartnerRequests>> =>
  adminListPage(params, listPartnerRequests);

export const approvePartnerRequestAction = async (
  partnerRequestUuid: string,
  isIntegrated: boolean,
): Promise<ActionResult> => {
  const { userId, user } = await requireAdmin();

  const request = await getPartnerRequestByUuid(partnerRequestUuid);
  if (!request) {
    return { error: "Partner request not found." };
  }

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

    const approvedClerkUserId = await inviteOrAttachClerkUser(
      request.email,
      publicMetadata,
    );

    await approvePartnerRequestRecord({
      partnerRequestUuid,
      approvedClerkUserId,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });

    // Set whether the partner is integrated (chosen at approval).
    await setPartnerIntegration({ partnerRequestUuid, isIntegrated });
  } catch (error) {
    return failClerk(error, "Failed to approve partner request.");
  }

  revalidatePath("/partners");
  return { success: true };
};

// Edit an already-approved partner's integration setting.
export const setPartnerIntegrationAction = async (
  partnerRequestUuid: string,
  isIntegrated: boolean,
): Promise<ActionResult> => {
  await requireAdmin();

  try {
    await setPartnerIntegration({ partnerRequestUuid, isIntegrated });
  } catch (error) {
    return fail(error, "Failed to update partner profile.");
  }

  revalidatePath("/partners");
  return { success: true };
};

export const rejectPartnerRequestAction = async (
  partnerRequestUuid: string,
  input: PartnerRejectionInput,
): Promise<ActionResult> => {
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
    return fail(error, "Failed to reject partner request.");
  }

  revalidatePath("/partners");
  return { success: true };
};
