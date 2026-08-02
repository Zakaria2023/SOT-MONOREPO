"use server";

import { SelectGovernmentRequests } from "@/db/schema/government-requests";
import { requireAdmin } from "@/lib/server/auth";
import { failClerk } from "@/lib/server/clerk-error";
import { inviteOrAttachClerkUser } from "@/lib/server/clerk";
import { adminListPage } from "@/lib/server/list";
import { revalidatePath } from "next/cache";
import {
  approveGovernmentRequest as approveGovernmentRequestRecord,
  getGovernmentRequestByUuid,
  listGovernmentRequests,
  rejectGovernmentRequest as rejectGovernmentRequestRecord,
} from "services";
import {
  ActionResult,
  fail,
  getReviewerName,
  ListParams,
  PaginatedResult,
} from "utils";
import {
  GovernmentRejectionInput,
  governmentRejectionSchema,
} from "validators";

// Searched + paginated page of government requests for the list table. The
// frontend drives `search`/`page` through URL search params.
export const getGovernmentRequestsPage = async (
  params: ListParams = {},
): Promise<PaginatedResult<SelectGovernmentRequests>> =>
  adminListPage(params, listGovernmentRequests);

export const approveGovernmentRequestAction = async (
  governmentRequestUuid: string,
): Promise<ActionResult> => {
  const { userId, user } = await requireAdmin();

  const request = await getGovernmentRequestByUuid(governmentRequestUuid);
  if (!request) {
    return { error: "Government request not found." };
  }

  try {
    if (request.status !== "pending") {
      throw new Error("This government request has already been reviewed");
    }

    // The entity details ride in publicMetadata so the webhook can build the
    // government Users row. A government official is a client, so their role is
    // "client" (they use the customer app, not a staff app).
    const publicMetadata = {
      role: "client",
      type: "government",
      entityName: request.entityName,
      fullName: request.fullName,
      contactNumber: request.contactNumber,
      location: request.location,
    };

    const approvedClerkUserId = await inviteOrAttachClerkUser(
      request.officialEmail,
      publicMetadata,
    );

    await approveGovernmentRequestRecord({
      governmentRequestUuid,
      approvedClerkUserId,
      reviewedByClerkUserId: userId,
      reviewedByName: getReviewerName(user),
    });
  } catch (error) {
    return failClerk(error, "Failed to approve government request.");
  }

  revalidatePath("/government");
  return { success: true };
};

export const rejectGovernmentRequestAction = async (
  governmentRequestUuid: string,
  input: GovernmentRejectionInput,
): Promise<ActionResult> => {
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
    return fail(error, "Failed to reject government request.");
  }

  revalidatePath("/government");
  return { success: true };
};
