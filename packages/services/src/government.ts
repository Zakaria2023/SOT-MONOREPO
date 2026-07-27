import { and, count, desc, eq, inArray, like, or } from "drizzle-orm";
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
  fullName: SelectGovernmentRequests["fullName"];
  contactNumber?: SelectGovernmentRequests["contactNumber"];
  location: SelectGovernmentRequests["location"];
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

const normalizeText = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

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
    fullName: input.fullName.trim(),
    contactNumber: normalizeText(input.contactNumber),
    location: input.location.trim(),
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

export type GovernmentRequestsListParams = {
  search?: string;
  limit: number;
  offset: number;
};

/**
 * A searched + paginated page of government requests, newest first (admin
 * review queue), plus the unfiltered total for that search. Search matches the
 * entity name, contact full name, or official email.
 */
export const listGovernmentRequests = async (
  params: GovernmentRequestsListParams,
): Promise<{ items: SelectGovernmentRequests[]; total: number }> => {
  const term = params.search?.trim();
  const where = term
    ? or(
        like(GovernmentRequests.entityName, `%${term}%`),
        like(GovernmentRequests.fullName, `%${term}%`),
        like(GovernmentRequests.officialEmail, `%${term}%`),
      )
    : undefined;

  const [items, [totals]] = await Promise.all([
    db
      .select()
      .from(GovernmentRequests)
      .where(where)
      .orderBy(desc(GovernmentRequests.createdAt), desc(GovernmentRequests.id))
      .limit(params.limit)
      .offset(params.offset),
    db.select({ total: count() }).from(GovernmentRequests).where(where),
  ]);

  return { items, total: Number(totals?.total ?? 0) };
};

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
    throw new ConflictError(
      "This government request has already been reviewed",
    );
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
    throw new ConflictError(
      "This government request has already been reviewed",
    );
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
