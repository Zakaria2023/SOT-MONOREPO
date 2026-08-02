"use server";

import type { SelectGovernmentRequests } from "@/db/schema/government-requests";
import { requireAdmin } from "@/lib/server/auth";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { clerkClient } from "@clerk/nextjs/server";
import type { ListParams, PaginatedResult } from "utils";
import { getReviewerName, paginate } from "utils";
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

// Searched + paginated page of government requests for the list table. The
// frontend drives `search`/`page` through URL search params.
export const getGovernmentRequestsPage = async (
  params: ListParams = {},
): Promise<PaginatedResult<GovernmentRequestListItem>> => {
  await requireAdmin();
  return paginate(params, ({ limit, offset }) =>
    listGovernmentRequests({ search: params.search, limit, offset }),
  );
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

    // If a Clerk account with this email already exists, an invitation would
    // never apply this metadata (invitations only seed brand-new signups), so
    // set it directly on the existing user; otherwise invite them.
    const { data: existingUsers } = await client.users.getUserList({
      emailAddress: [request.officialEmail],
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
        emailAddress: request.officialEmail,
        ignoreExisting: true,
        publicMetadata,
      });
      approvedClerkUserId = invitation.id;
    }

    await approveGovernmentRequestRecord({
      governmentRequestUuid,
      approvedClerkUserId,
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
