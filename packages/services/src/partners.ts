import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import {
  PartnerRequests,
  SelectPartnerRequests,
} from "../../../db/schema/partner-requests";

/**
 * A database handle that is either the base connection or an open transaction,
 * so a helper can run standalone or as part of a caller's transaction.
 */
export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

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

/**
 * An approved partner offered for a BOQ.
 * `rank` is 1-based closeness among same-city matches (1 = closest); it is `0`
 * for partners that are not a same-city match (offered for manual selection).
 */
export type MatchedPartner = {
  partnerRequestUuid: string;
  clerkUserId: string;
  name: string;
  location: string | null;
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
};

// A same-city match scores >= 100 (see scoreLocationCloseness).
const SAME_CITY_SCORE = 100;

// Splits a free-text location ("Riyadh, Saudi Arabia") into comparable tokens.
const locationTokens = (value: string | null | undefined): string[] =>
  (value ?? "")
    .toLowerCase()
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

// Heuristic closeness score for two free-text locations (higher = closer).
// A shared city (the first token) dominates; other shared tokens (region,
// country) add smaller amounts. Locations have no coordinates, so this is a
// token-overlap approximation rather than true geographic distance.
const scoreLocationCloseness = (
  userLocation: string | null,
  partnerLocation: string | null,
): number => {
  const userParts = locationTokens(userLocation);
  const partnerParts = locationTokens(partnerLocation);
  if (userParts.length === 0 || partnerParts.length === 0) return 0;

  const partnerSet = new Set(partnerParts);
  const shared = userParts.filter((token) => partnerSet.has(token)).length;
  const cityMatch = userParts[0] === partnerParts[0] ? 1 : 0;

  return cityMatch * 100 + shared * 10;
};

/**
 * Splits approved partners for a BOQ into same-city matches (`close`, ranked
 * closest-first) and everyone else (`others`, offered for manual selection).
 * Within each group, ties break toward the most recently approved partner.
 */
export const getApprovedPartnerOptions = async (
  userLocation: string | null,
  executor: DbExecutor = db,
): Promise<BoqPartnerOptions> => {
  const partners = await executor
    .select({
      partnerRequestUuid: PartnerRequests.uuid,
      clerkUserId: PartnerRequests.approvedClerkUserId,
      fullName: PartnerRequests.fullName,
      companyName: PartnerRequests.companyName,
      location: PartnerRequests.location,
      createdAt: PartnerRequests.createdAt,
    })
    .from(PartnerRequests)
    .where(
      and(
        eq(PartnerRequests.status, "approved"),
        isNotNull(PartnerRequests.approvedClerkUserId),
      ),
    );

  const scored = partners
    .flatMap((partner) =>
      partner.clerkUserId
        ? [{ partner, clerkUserId: partner.clerkUserId }]
        : [],
    )
    .map(({ partner, clerkUserId }) => ({
      partner,
      clerkUserId,
      score: scoreLocationCloseness(userLocation, partner.location),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.partner.createdAt.getTime() - a.partner.createdAt.getTime(),
    );

  const closeEntries = scored.filter((entry) => entry.score >= SAME_CITY_SCORE);
  const otherEntries = scored.filter((entry) => entry.score < SAME_CITY_SCORE);

  const toMatched = (
    { partner, clerkUserId }: (typeof scored)[number],
    rank: number,
  ): MatchedPartner => ({
    partnerRequestUuid: partner.partnerRequestUuid,
    clerkUserId,
    name: partner.companyName || partner.fullName,
    location: partner.location,
    rank,
  });

  return {
    close: closeEntries.map((entry, index) => toMatched(entry, index + 1)),
    others: otherEntries.map((entry) => toMatched(entry, 0)),
  };
};
