import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  like,
  or,
} from "drizzle-orm";
import type { ListQuery } from "utils";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { BoqPartners } from "../../../db/schema/boq-partners";
import { Offers } from "../../../db/schema/offers";
import {
  PartnerRequests,
  SelectPartnerRequests,
} from "../../../db/schema/partner-requests";
import {
  partnerCapabilities,
  type PartnerCapability,
} from "../../../db/enum";
import { matchPartners } from "./partner-matching";
import { ConflictError, ValidationError } from "./errors";

/**
 * A database handle that is either the base connection or an open transaction,
 * so a helper can run standalone or as part of a caller's transaction.
 */
export type DbExecutor =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PartnerRequestInput = {
  capabilities?: SelectPartnerRequests["capabilities"];
  type: SelectPartnerRequests["type"];
  email: SelectPartnerRequests["email"];
  contactNumber?: SelectPartnerRequests["contactNumber"];
  location: SelectPartnerRequests["location"];
  // Individual identity + name (null/absent for other types).
  firstName?: SelectPartnerRequests["firstName"];
  middleName?: SelectPartnerRequests["middleName"];
  lastName?: SelectPartnerRequests["lastName"];
  // Government contact person, submitted directly (other types compose it).
  fullName?: SelectPartnerRequests["fullName"];
  // Facility business fields (companyName doubles as the government entity
  // name; the rest are null/absent for other types).
  companyName?: SelectPartnerRequests["companyName"];
  unifiedNumber?: SelectPartnerRequests["unifiedNumber"];
  crNumber?: SelectPartnerRequests["crNumber"];
  vatNumber?: SelectPartnerRequests["vatNumber"];
  nationalAddress?: SelectPartnerRequests["nationalAddress"];
  crCertificate?: SelectPartnerRequests["crCertificate"];
  vatCertificate?: SelectPartnerRequests["vatCertificate"];
  representativeName?: SelectPartnerRequests["representativeName"];
};

export type ApprovePartnerRequestInput = {
  partnerRequestUuid: SelectPartnerRequests["uuid"];
  approvedClerkUserId: NonNullable<
    SelectPartnerRequests["approvedClerkUserId"]
  >;
  reviewedByClerkUserId?: SelectPartnerRequests["reviewedByClerkUserId"];
  reviewedByName?: SelectPartnerRequests["reviewedByName"];
};

export type RejectPartnerRequestInput = {
  partnerRequestUuid: SelectPartnerRequests["uuid"];
  rejectionReason: NonNullable<SelectPartnerRequests["rejectionReason"]>;
  reviewedByClerkUserId?: SelectPartnerRequests["reviewedByClerkUserId"];
  reviewedByName?: SelectPartnerRequests["reviewedByName"];
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const normalizeText = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Create a pending partner request, rejecting a duplicate active email. */
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
    throw new ConflictError(
      existingActiveRequest.status === "approved"
        ? "This email has already been approved as a partner."
        : "A partner request with this email is already pending review.",
    );
  }

  const uuid = randomUUID();

  // Display name: the composed name parts for individuals, the
  // representative's name for facilities, the submitted contact person for
  // government entities.
  const fullName =
    input.type === "individual"
      ? [input.firstName, input.middleName, input.lastName]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(" ")
      : input.type === "government"
        ? (input.fullName?.trim() ?? "")
        : (input.representativeName?.trim() ?? "");

  if (!fullName) {
    throw new ValidationError("A name is required");
  }

  await db.insert(PartnerRequests).values({
    uuid,
    capabilities: input.capabilities ?? [],
    type: input.type,
    fullName,
    email,
    contactNumber: normalizeText(input.contactNumber),
    location: input.location.trim(),
    firstName: normalizeText(input.firstName),
    middleName: normalizeText(input.middleName),
    lastName: normalizeText(input.lastName),
    companyName: normalizeText(input.companyName),
    unifiedNumber: normalizeText(input.unifiedNumber),
    crNumber: normalizeText(input.crNumber),
    vatNumber: normalizeText(input.vatNumber),
    nationalAddress: normalizeText(input.nationalAddress),
    crCertificate: normalizeText(input.crCertificate),
    vatCertificate: normalizeText(input.vatCertificate),
    representativeName: normalizeText(input.representativeName),
  });

  const [request] = await db
    .select()
    .from(PartnerRequests)
    .where(eq(PartnerRequests.uuid, uuid));

  if (!request) {
    throw new Error("Failed to create partner request");
  }

  return request;
};

/**
 * A searched + paginated page of partner requests, newest first (admin review
 * queue), plus the unfiltered total for that search. Search matches the company
 * name, contact full name, or email.
 */
export const listPartnerRequests = async (
  params: ListQuery,
): Promise<{ items: SelectPartnerRequests[]; total: number }> => {
  const term = params.search?.trim();
  const where = term
    ? or(
        like(PartnerRequests.companyName, `%${term}%`),
        like(PartnerRequests.fullName, `%${term}%`),
        like(PartnerRequests.email, `%${term}%`),
      )
    : undefined;

  const [items, [totals]] = await Promise.all([
    db
      .select()
      .from(PartnerRequests)
      .where(where)
      .orderBy(desc(PartnerRequests.createdAt), desc(PartnerRequests.id))
      .limit(params.limit)
      .offset(params.offset),
    db.select({ total: count() }).from(PartnerRequests).where(where),
  ]);

  return { items, total: Number(totals?.total ?? 0) };
};

/** The partner request with this uuid, or null. */
export const getPartnerRequestByUuid = async (
  uuid: string,
): Promise<SelectPartnerRequests | null> => {
  const [request] = await db
    .select()
    .from(PartnerRequests)
    .where(eq(PartnerRequests.uuid, uuid));

  return request ?? null;
};

/** Approve a pending partner request, linking the approved Clerk user. */
export const approvePartnerRequest = async ({
  partnerRequestUuid,
  approvedClerkUserId,
  reviewedByClerkUserId = null,
  reviewedByName = null,
}: ApprovePartnerRequestInput): Promise<void> => {
  const request = await getPartnerRequestByUuid(partnerRequestUuid);

  if (!request) {
    throw new ValidationError("Partner request not found");
  }

  if (request.status !== "pending") {
    throw new ConflictError("This partner request has already been reviewed");
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

/** Reject a pending partner request with a reason. */
export const rejectPartnerRequest = async ({
  partnerRequestUuid,
  rejectionReason,
  reviewedByClerkUserId = null,
  reviewedByName = null,
}: RejectPartnerRequestInput): Promise<void> => {
  const request = await getPartnerRequestByUuid(partnerRequestUuid);

  if (!request) {
    throw new ValidationError("Partner request not found");
  }

  if (request.status !== "pending") {
    throw new ConflictError("This partner request has already been reviewed");
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

/**
 * An approved partner offered for a BOQ.
 * `rank` is 1-based closeness among same-city matches (1 = closest); it is `0`
 * for partners that are not a same-city match (offered for manual selection).
 */
export type MatchedPartner = {
  partnerRequestUuid: SelectPartnerRequests["uuid"];
  clerkUserId: NonNullable<SelectPartnerRequests["approvedClerkUserId"]>;
  name: string; // companyName || fullName — composed, no single column
  location: SelectPartnerRequests["location"];
  rank: number;
};

/**
 * Approved partners split for a BOQ:
 * - `close`  — same-city matches, auto-suggested and pre-selected (rank 1..n).
 * - `others` — every other approved partner, for the pre-seller to pick
 *   manually when there aren't enough close ones (rank 0).
 */
export type BoqPartnerOptions = {
  close: MatchedPartner[];
  others: MatchedPartner[];
  // Approved partners who cannot take this job, each with the reason. Carried
  // rather than filtered away: a partner somebody expected to see, simply
  // absent, reads as a bug in the matcher rather than as a capability they lack.
  unable: (MatchedPartner & { reason: string })[];
  // True when the job has no location, so the order is by standing and not by
  // distance. A list that looks confidently sorted when nothing could be sorted
  // is worse than one that says so.
  unranked: boolean;
};

/**
 * Who can take this job, closest first.
 *
 * Capability is a FILTER and proximity is the ranking — see partner-matching.ts
 * for why they are not blended. This function used to rank on location alone,
 * so a pre-seller in the right city sorted above an installer in the next one
 * for an installation job.
 *
 * `needsAnyOf` defaults to the two installation capabilities, because every
 * caller today is assigning installation work. Passed explicitly rather than
 * assumed inside the matcher, so a different kind of job says what it needs.
 */
export const getApprovedPartnerOptions = async (
  userLocation: string | null,
  executor: DbExecutor = db,
  needsAnyOf: PartnerCapability[] = ["install_only", "install_program"],
): Promise<BoqPartnerOptions> => {
  const partners = await executor
    .select({
      partnerRequestUuid: PartnerRequests.uuid,
      clerkUserId: PartnerRequests.approvedClerkUserId,
      fullName: PartnerRequests.fullName,
      companyName: PartnerRequests.companyName,
      location: PartnerRequests.location,
      capabilities: PartnerRequests.capabilities,
      createdAt: PartnerRequests.createdAt,
    })
    .from(PartnerRequests)
    .where(
      and(
        eq(PartnerRequests.status, "approved"),
        isNotNull(PartnerRequests.approvedClerkUserId),
      ),
    );

  const outcome = matchPartners(
    partners.flatMap((partner) =>
      partner.clerkUserId
        ? [
            {
              partnerRequestUuid: partner.partnerRequestUuid,
              clerkUserId: partner.clerkUserId,
              name: partner.companyName || partner.fullName,
              location: partner.location,
              capabilities: (partner.capabilities ?? []).filter(
                (capability): capability is PartnerCapability =>
                  (partnerCapabilities as readonly string[]).includes(
                    capability,
                  ),
              ),
              approvedAt: partner.createdAt,
            },
          ]
        : [],
    ),
    { location: userLocation, needsAnyOf },
  );

  const toMatched = (
    match: (typeof outcome.eligible)[number],
  ): MatchedPartner => ({
    partnerRequestUuid: match.candidate.partnerRequestUuid,
    clerkUserId: match.candidate.clerkUserId,
    name: match.candidate.name,
    location: match.candidate.location,
    rank: match.rank,
  });

  return {
    // `close` keeps its meaning — the ones to auto-suggest — and is now the
    // same-city eligible partners rather than everyone who scored 100.
    close: outcome.eligible
      .filter((match) => match.proximity === "same_city")
      .map(toMatched),
    others: outcome.eligible
      .filter((match) => match.proximity !== "same_city")
      .map((match) => ({ ...toMatched(match), rank: 0 })),
    unable: outcome.ineligible.map((match) => ({
      ...toMatched(match),
      rank: 0,
      reason: match.reason ?? "Cannot take this job.",
    })),
    unranked: outcome.unranked,
  };
};

// Point an approved partner request at the real Clerk user id once that account
// exists. Approval may store an invitation id (for a brand-new signup); when
// the user is created/updated the webhook calls this so getApprovedPartnerByClerkId
// resolves by the signed-in user's id. Matches by email; a no-op if none.
export const linkPartnerRequestToClerkUser = async ({
  email,
  clerkUserId,
}: {
  email: string;
  clerkUserId: string;
}): Promise<void> => {
  const normalized = normalizeEmail(email);

  const [request] = await db
    .select({ oldId: PartnerRequests.approvedClerkUserId })
    .from(PartnerRequests)
    .where(
      and(
        eq(PartnerRequests.email, normalized),
        eq(PartnerRequests.status, "approved"),
      ),
    );
  // No approved request, or already linked to this user — nothing to do.
  if (!request || request.oldId === clerkUserId) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(PartnerRequests)
      .set({ approvedClerkUserId: clerkUserId })
      .where(
        and(
          eq(PartnerRequests.email, normalized),
          eq(PartnerRequests.status, "approved"),
        ),
      );

    // Re-point anything dispatched/quoted under the old id (e.g. an invitation
    // id used before the partner signed up) to the real user id, so their
    // incoming BOQs and offers resolve.
    if (request.oldId) {
      await tx
        .update(BoqPartners)
        .set({ partnerClerkUserId: clerkUserId })
        .where(eq(BoqPartners.partnerClerkUserId, request.oldId));
      await tx
        .update(Offers)
        .set({ partnerClerkUserId: clerkUserId })
        .where(eq(Offers.partnerClerkUserId, request.oldId));
    }
  });
};

// Set whether a partner is integrated (auto-invoiced & paid at handover).
// Admin only. Badge isn't set here — every partner prices at the SI rate.
export const setPartnerIntegration = async ({
  partnerRequestUuid,
  isIntegrated,
}: {
  partnerRequestUuid: SelectPartnerRequests["uuid"];
  isIntegrated: SelectPartnerRequests["isIntegrated"];
}): Promise<void> => {
  const [existing] = await db
    .select({ id: PartnerRequests.id })
    .from(PartnerRequests)
    .where(eq(PartnerRequests.uuid, partnerRequestUuid));
  if (!existing) {
    throw new ValidationError("Partner not found");
  }

  await db
    .update(PartnerRequests)
    .set({ isIntegrated })
    .where(eq(PartnerRequests.uuid, partnerRequestUuid));
};
