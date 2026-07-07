import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import {
  PartnerRequests,
  SelectPartnerRequests,
} from "../../../db/schema/partner-requests";

export type PartnerRequestInput = {
  fullName: string;
  companyName: string;
  email: string;
  location?: string;
  about?: string;
  offer?: string;
  special?: string;
  serviceScope: string;
};

export type ApprovePartnerRequestInput = {
  partnerRequestUuid: string;
  approvedClerkUserId: string;
  reviewedByClerkUserId?: string | null;
  reviewedByName?: string | null;
};

export type RejectPartnerRequestInput = {
  partnerRequestUuid: string;
  rejectionReason: string;
  reviewedByClerkUserId?: string | null;
  reviewedByName?: string | null;
};

const normalizeText = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const createPartnerRequest = async (
  input: PartnerRequestInput,
): Promise<SelectPartnerRequests> => {
  const email = normalizeEmail(input.email);

  const [existingActiveRequest] = await db
    .select({
      uuid: PartnerRequests.uuid,
      status: PartnerRequests.status,
    })
    .from(PartnerRequests)
    .where(
      and(
        eq(PartnerRequests.email, email),
        inArray(PartnerRequests.status, ["pending", "approved"]),
      ),
    )
    .orderBy(desc(PartnerRequests.createdAt));

  if (existingActiveRequest) {
    throw new Error(
      existingActiveRequest.status === "approved"
        ? "This email has already been approved as a partner."
        : "A partner request with this email is already pending review.",
    );
  }

  const uuid = randomUUID();

  await db.insert(PartnerRequests).values({
    uuid,
    fullName: input.fullName.trim(),
    companyName: input.companyName.trim(),
    email,
    location: normalizeText(input.location),
    about: normalizeText(input.about),
    offer: normalizeText(input.offer),
    special: normalizeText(input.special),
    serviceScope: input.serviceScope,
  });

  const [request] = await db
    .select()
    .from(PartnerRequests)
    .where(eq(PartnerRequests.uuid, uuid));

  if (!request) throw new Error("Failed to create partner request");

  return request;
};

export const listPartnerRequests = async (): Promise<SelectPartnerRequests[]> =>
  db
    .select()
    .from(PartnerRequests)
    .orderBy(desc(PartnerRequests.createdAt), desc(PartnerRequests.id));

export const getPartnerRequestByUuid = async (
  uuid: string,
): Promise<SelectPartnerRequests | null> => {
  const [request] = await db
    .select()
    .from(PartnerRequests)
    .where(eq(PartnerRequests.uuid, uuid));

  return request ?? null;
};

export const approvePartnerRequest = async ({
  partnerRequestUuid,
  approvedClerkUserId,
  reviewedByClerkUserId = null,
  reviewedByName = null,
}: ApprovePartnerRequestInput): Promise<void> => {
  const request = await getPartnerRequestByUuid(partnerRequestUuid);

  if (!request) {
    throw new Error("Partner request not found");
  }

  if (request.status !== "pending") {
    throw new Error("This partner request has already been reviewed");
  }

  await db
    .update(PartnerRequests)
    .set({
      status: "approved",
      approvedClerkUserId,
      rejectionReason: null,
      reviewedByClerkUserId,
      reviewedByName,
      approvedAt: new Date(),
      rejectedAt: null,
    })
    .where(eq(PartnerRequests.uuid, partnerRequestUuid));
};

export const rejectPartnerRequest = async ({
  partnerRequestUuid,
  rejectionReason,
  reviewedByClerkUserId = null,
  reviewedByName = null,
}: RejectPartnerRequestInput): Promise<void> => {
  const request = await getPartnerRequestByUuid(partnerRequestUuid);

  if (!request) {
    throw new Error("Partner request not found");
  }

  if (request.status !== "pending") {
    throw new Error("This partner request has already been reviewed");
  }

  await db
    .update(PartnerRequests)
    .set({
      status: "rejected",
      rejectionReason: rejectionReason.trim(),
      approvedClerkUserId: null,
      reviewedByClerkUserId,
      reviewedByName,
      approvedAt: null,
      rejectedAt: new Date(),
    })
    .where(eq(PartnerRequests.uuid, partnerRequestUuid));
};
