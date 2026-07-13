import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import {
  GovernmentRequests,
  SelectGovernmentRequests,
} from "../../../db/schema/government-requests";
import { ConflictError, ValidationError } from "./errors";

export type GovernmentRequestInput = {
  officialEmail: SelectGovernmentRequests["officialEmail"];
  entityName: SelectGovernmentRequests["entityName"];
  contactNumber: SelectGovernmentRequests["contactNumber"];
};

export type ApproveGovernmentRequestInput = {
  governmentRequestUuid: SelectGovernmentRequests["uuid"];
  approvedClerkUserId: NonNullable<
    SelectGovernmentRequests["approvedClerkUserId"]
  >;
  reviewedByClerkUserId?: SelectGovernmentRequests["reviewedByClerkUserId"];
  reviewedByName?: SelectGovernmentRequests["reviewedByName"];
};

export type RejectGovernmentRequestInput = {
  governmentRequestUuid: SelectGovernmentRequests["uuid"];
  rejectionReason: NonNullable<SelectGovernmentRequests["rejectionReason"]>;
  reviewedByClerkUserId?: SelectGovernmentRequests["reviewedByClerkUserId"];
  reviewedByName?: SelectGovernmentRequests["reviewedByName"];
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Create a pending government request, rejecting a duplicate active email. */
export const createGovernmentRequest = async (
  input: GovernmentRequestInput,
): Promise<SelectGovernmentRequests> => {
  const officialEmail = normalizeEmail(input.officialEmail);

  const [existingActive] = await db
    .select({
      uuid: GovernmentRequests.uuid,
      status: GovernmentRequests.status,
    })
    .from(GovernmentRequests)
    .where(
      and(
        eq(GovernmentRequests.officialEmail, officialEmail),
        inArray(GovernmentRequests.status, ["pending", "approved"]),
      ),
    )
    .orderBy(desc(GovernmentRequests.createdAt));

  if (existingActive) {
    throw new ConflictError(
      existingActive.status === "approved"
        ? "This email has already been approved."
        : "A government request with this email is already pending review.",
    );
  }

  const uuid = randomUUID();

  await db.insert(GovernmentRequests).values({
    uuid,
    officialEmail,
    entityName: input.entityName.trim(),
    contactNumber: input.contactNumber.trim(),
  });

  const [request] = await db
    .select()
    .from(GovernmentRequests)
    .where(eq(GovernmentRequests.uuid, uuid));

  if (!request) {
    throw new Error("Failed to create government request");
  }

  return request;
};

/** Every government request, newest first (admin review queue). */
export const listGovernmentRequests = async (): Promise<
  SelectGovernmentRequests[]
> =>
  db
    .select()
    .from(GovernmentRequests)
    .orderBy(desc(GovernmentRequests.createdAt), desc(GovernmentRequests.id));

/** The government request with this uuid, or null. */
export const getGovernmentRequestByUuid = async (
  uuid: string,
): Promise<SelectGovernmentRequests | null> => {
  const [request] = await db
    .select()
    .from(GovernmentRequests)
    .where(eq(GovernmentRequests.uuid, uuid));

  return request ?? null;
};

/** Approve a pending government request, linking the invited Clerk user. */
export const approveGovernmentRequest = async ({
  governmentRequestUuid,
  approvedClerkUserId,
  reviewedByClerkUserId = null,
  reviewedByName = null,
}: ApproveGovernmentRequestInput): Promise<void> => {
  const request = await getGovernmentRequestByUuid(governmentRequestUuid);

  if (!request) {
    throw new ValidationError("Government request not found");
  }

  if (request.status !== "pending") {
    throw new ConflictError("This government request has already been reviewed");
  }

  await db
    .update(GovernmentRequests)
    .set({
      status: "approved",
      approvedClerkUserId,
      rejectionReason: null,
      reviewedByClerkUserId,
      reviewedByName,
      approvedAt: new Date(),
      rejectedAt: null,
    })
    .where(eq(GovernmentRequests.uuid, governmentRequestUuid));
};

/** Reject a pending government request with a reason. */
export const rejectGovernmentRequest = async ({
  governmentRequestUuid,
  rejectionReason,
  reviewedByClerkUserId = null,
  reviewedByName = null,
}: RejectGovernmentRequestInput): Promise<void> => {
  const request = await getGovernmentRequestByUuid(governmentRequestUuid);

  if (!request) {
    throw new ValidationError("Government request not found");
  }

  if (request.status !== "pending") {
    throw new ConflictError("This government request has already been reviewed");
  }

  await db
    .update(GovernmentRequests)
    .set({
      status: "rejected",
      rejectionReason: rejectionReason.trim(),
      approvedClerkUserId: null,
      reviewedByClerkUserId,
      reviewedByName,
      approvedAt: null,
      rejectedAt: new Date(),
    })
    .where(eq(GovernmentRequests.uuid, governmentRequestUuid));
};
