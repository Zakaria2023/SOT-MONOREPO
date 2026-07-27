import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  like,
  lte,
  or,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { BoqPartners } from "../../../db/schema/boq-partners";
import { Boqs, SelectBoqs } from "../../../db/schema/boqs";
import { Offers, SelectOffers } from "../../../db/schema/offers";
import {
  PartnerRequests,
  SelectPartnerRequests,
} from "../../../db/schema/partner-requests";
import { SelectUsers, Users } from "../../../db/schema/users";
import { ConflictError, ForbiddenError, ValidationError } from "./errors";

export type { SelectOffers };

// How long an approved offer stays selectable before it expires (stage 3:
// "expires if unpaid"). Adjustable in Phase 1.
export const OFFER_VALIDITY_DAYS = 14;

export type ApprovedPartner = {
  partnerRequestUuid: SelectPartnerRequests["uuid"];
  name: string; // companyName || fullName — composed, no single column
  serviceScope: SelectPartnerRequests["serviceScope"];
};

export type CreateOfferInput = {
  partnerClerkUserId: SelectOffers["partnerClerkUserId"];
  boqUuid: SelectOffers["boqUuid"];
  productPrice: SelectOffers["productPrice"];
  installPrice: SelectOffers["installPrice"];
  programmingPrice?: NonNullable<SelectOffers["programmingPrice"]>;
  description: SelectOffers["description"];
  presentationMode?: SelectOffers["presentationMode"];
};

export type OfferReviewInput = {
  offerUuid: SelectOffers["uuid"];
  reviewedByClerkUserId?: SelectOffers["reviewedByClerkUserId"];
  reviewedByName?: SelectOffers["reviewedByName"];
};

export type RejectOfferInput = OfferReviewInput & {
  rejectionReason: NonNullable<SelectOffers["rejectionReason"]>;
};

export type OfferListItem = SelectOffers & {
  boqReference: SelectBoqs["reference"] | null;
  customerName: SelectUsers["fullName"] | null;
};

/** The approved partner profile (scope/name) behind a Clerk user, or null. */
export const getApprovedPartnerByClerkId = async (
  clerkUserId: string,
): Promise<ApprovedPartner | null> => {
  const [row] = await db
    .select({
      uuid: PartnerRequests.uuid,
      fullName: PartnerRequests.fullName,
      companyName: PartnerRequests.companyName,
      serviceScope: PartnerRequests.serviceScope,
    })
    .from(PartnerRequests)
    .where(
      and(
        eq(PartnerRequests.approvedClerkUserId, clerkUserId),
        eq(PartnerRequests.status, "approved"),
      ),
    );

  if (!row) {
    return null;
  }
  return {
    partnerRequestUuid: row.uuid,
    name: row.companyName || row.fullName,
    serviceScope: row.serviceScope,
  };
};

/** The offer a partner has made against a BOQ, if any. */
export const getPartnerOffer = async (
  partnerClerkUserId: string,
  boqUuid: string,
): Promise<SelectOffers | null> => {
  const [offer] = await db
    .select()
    .from(Offers)
    .where(
      and(
        eq(Offers.boqUuid, boqUuid),
        eq(Offers.partnerClerkUserId, partnerClerkUserId),
      ),
    );
  return offer ?? null;
};

/**
 * Creates or updates a partner's offer for a BOQ dispatched to them. Editing an
 * existing offer resets it to pending review. Installation-only partners never
 * store a programming price; install+program partners must provide one.
 */
export const createOrUpdateOffer = async (
  input: CreateOfferInput,
): Promise<SelectOffers> => {
  const [dispatch] = await db
    .select({ id: BoqPartners.id })
    .from(BoqPartners)
    .where(
      and(
        eq(BoqPartners.boqUuid, input.boqUuid),
        eq(BoqPartners.partnerClerkUserId, input.partnerClerkUserId),
      ),
    );
  if (!dispatch) {
    throw new ForbiddenError("This BOQ was not sent to you");
  }

  const partner = await getApprovedPartnerByClerkId(input.partnerClerkUserId);
  if (!partner) {
    throw new ValidationError("Partner profile not found");
  }

  const programmingPrice =
    partner.serviceScope === "install-program"
      ? input.programmingPrice
      : undefined;
  if (
    partner.serviceScope === "install-program" &&
    (!programmingPrice || programmingPrice.length === 0)
  ) {
    throw new ValidationError("Programming price is required");
  }

  const existing = await getPartnerOffer(
    input.partnerClerkUserId,
    input.boqUuid,
  );
  if (
    existing &&
    (existing.status === "approved" || existing.status === "selected")
  ) {
    throw new ConflictError(
      "Your offer has already been approved and can't be changed",
    );
  }

  const values = {
    partnerRequestUuid: partner.partnerRequestUuid,
    partnerName: partner.name,
    serviceScope: partner.serviceScope,
    productPrice: input.productPrice,
    installPrice: input.installPrice,
    programmingPrice: programmingPrice ?? null,
    description: input.description.trim(),
    presentationMode: input.presentationMode ?? "itemized",
  };

  if (existing) {
    await db
      .update(Offers)
      .set({
        ...values,
        status: "pending",
        rejectionReason: null,
        reviewedByClerkUserId: null,
        reviewedByName: null,
        approvedAt: null,
        rejectedAt: null,
      })
      .where(eq(Offers.id, existing.id));

    const updated = await getPartnerOffer(
      input.partnerClerkUserId,
      input.boqUuid,
    );
    if (!updated) {
      throw new Error("Failed to save offer");
    }
    return updated;
  }

  const uuid = randomUUID();
  await db.insert(Offers).values({
    uuid,
    boqUuid: input.boqUuid,
    partnerClerkUserId: input.partnerClerkUserId,
    ...values,
  });

  const [created] = await db.select().from(Offers).where(eq(Offers.uuid, uuid));
  if (!created) {
    throw new Error("Failed to save offer");
  }
  return created;
};

export type OffersListParams = {
  search?: string;
  limit: number;
  offset: number;
};

/**
 * A searched + paginated page of offers, each with its BOQ reference and
 * customer name (admin review), plus the unfiltered total for that search.
 * Search matches the BOQ reference or the customer name.
 */
export const listOffers = async (
  params: OffersListParams,
): Promise<{ items: OfferListItem[]; total: number }> => {
  const term = params.search?.trim();
  const where = term
    ? or(like(Boqs.reference, `%${term}%`), like(Users.fullName, `%${term}%`))
    : undefined;

  const [items, [totals]] = await Promise.all([
    db
      .select({
        ...getTableColumns(Offers),
        boqReference: Boqs.reference,
        customerName: Users.fullName,
      })
      .from(Offers)
      .leftJoin(Boqs, eq(Offers.boqUuid, Boqs.uuid))
      .leftJoin(Users, eq(Boqs.userUuid, Users.uuid))
      .where(where)
      .orderBy(desc(Offers.createdAt))
      .limit(params.limit)
      .offset(params.offset),
    db
      .select({ total: count() })
      .from(Offers)
      .leftJoin(Boqs, eq(Offers.boqUuid, Boqs.uuid))
      .leftJoin(Users, eq(Boqs.userUuid, Users.uuid))
      .where(where),
  ]);

  return { items, total: Number(totals?.total ?? 0) };
};

/** The offer with this uuid, or null. */
export const getOfferByUuid = async (
  uuid: string,
): Promise<SelectOffers | null> => {
  const [offer] = await db.select().from(Offers).where(eq(Offers.uuid, uuid));
  return offer ?? null;
};

/** Approves a pending offer, making it visible to the customer. */
export const approveOffer = async ({
  offerUuid,
  reviewedByClerkUserId = null,
  reviewedByName = null,
}: OfferReviewInput): Promise<void> => {
  const offer = await getOfferByUuid(offerUuid);
  if (!offer) {
    throw new ValidationError("Offer not found");
  }
  if (offer.status !== "pending") {
    throw new ConflictError("This offer has already been reviewed");
  }

  const approvedAt = new Date();
  const expiresAt = new Date(
    approvedAt.getTime() + OFFER_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  );

  // Approving an offer presents a price to the customer — the BOQ is now
  // "offered". Guard the update so a BOQ already past this stage (ordered and
  // beyond) isn't dragged backwards.
  await db.transaction(async (tx) => {
    await tx
      .update(Offers)
      .set({
        status: "approved",
        rejectionReason: null,
        reviewedByClerkUserId,
        reviewedByName,
        approvedAt,
        expiresAt,
        rejectedAt: null,
      })
      .where(eq(Offers.uuid, offerUuid));

    await tx
      .update(Boqs)
      .set({ status: "offered" })
      .where(
        and(
          eq(Boqs.uuid, offer.boqUuid),
          inArray(Boqs.status, ["draft", "validated", "submitted", "reviewed"]),
        ),
      );
  });
};

/** Rejects a pending offer with a reason. */
export const rejectOffer = async ({
  offerUuid,
  rejectionReason,
  reviewedByClerkUserId = null,
  reviewedByName = null,
}: RejectOfferInput): Promise<void> => {
  const offer = await getOfferByUuid(offerUuid);
  if (!offer) {
    throw new ValidationError("Offer not found");
  }
  if (offer.status !== "pending") {
    throw new ConflictError("This offer has already been reviewed");
  }

  await db
    .update(Offers)
    .set({
      status: "rejected",
      rejectionReason: rejectionReason.trim(),
      reviewedByClerkUserId,
      reviewedByName,
      rejectedAt: new Date(),
      approvedAt: null,
    })
    .where(eq(Offers.uuid, offerUuid));
};

// Verifies a BOQ belongs to the given customer, returning it or null.
const getOwnedBoq = async (userUuid: string, boqUuid: string) => {
  const [boq] = await db
    .select({ uuid: Boqs.uuid })
    .from(Boqs)
    .where(and(eq(Boqs.uuid, boqUuid), eq(Boqs.userUuid, userUuid)));
  return boq ?? null;
};

/** An approved/selected offer enriched with its BOQ reference (customer view). */
export type OfferForUser = SelectOffers & {
  boqReference: SelectBoqs["reference"] | null;
};

/**
 * Every approved (and customer-selected) offer across all BOQs the user owns,
 * each tagged with its BOQ reference. Powers the customer's "Your offers" page.
 */
export const getOffersForUser = async (
  userUuid: string,
): Promise<OfferForUser[]> =>
  db
    .select({
      ...getTableColumns(Offers),
      boqReference: Boqs.reference,
    })
    .from(Offers)
    .innerJoin(Boqs, eq(Offers.boqUuid, Boqs.uuid))
    .where(
      and(
        eq(Boqs.userUuid, userUuid),
        inArray(Offers.status, ["approved", "selected"]),
      ),
    )
    .orderBy(desc(Offers.status), desc(Offers.createdAt));

/** Approved (and the customer-selected) offers for a BOQ the user owns. */
export const getApprovedOffersForUser = async (
  userUuid: string,
  boqUuid: string,
): Promise<SelectOffers[]> =>
  db
    .select(getTableColumns(Offers))
    .from(Offers)
    .innerJoin(Boqs, eq(Offers.boqUuid, Boqs.uuid))
    .where(
      and(
        eq(Boqs.uuid, boqUuid),
        eq(Boqs.userUuid, userUuid),
        inArray(Offers.status, ["approved", "selected"]),
      ),
    )
    .orderBy(desc(Offers.status), Offers.createdAt);

/**
 * Expires every approved-but-unselected offer whose validity window has passed.
 * Selected offers are left alone — the customer already committed. Returns how
 * many were expired. Meant to be run on a schedule.
 */
export const expireStaleOffers = async (): Promise<number> => {
  const result = await db
    .update(Offers)
    .set({ status: "expired" })
    .where(
      and(eq(Offers.status, "approved"), lte(Offers.expiresAt, new Date())),
    );
  // drizzle mysql returns [ResultSetHeader]; affectedRows is the count.
  const [header] = result;
  return header.affectedRows;
};

/** Marks one approved offer as the customer's selection (replaces any prior). */
export const selectOffer = async ({
  userUuid,
  boqUuid,
  offerUuid,
}: {
  userUuid: string;
  boqUuid: string;
  offerUuid: string;
}): Promise<void> => {
  const boq = await getOwnedBoq(userUuid, boqUuid);
  if (!boq) {
    throw new ValidationError("BOQ not found");
  }

  const offer = await getOfferByUuid(offerUuid);
  if (!offer || offer.boqUuid !== boqUuid) {
    throw new ValidationError("Offer not found");
  }
  if (offer.status !== "approved" && offer.status !== "selected") {
    throw new ConflictError("This offer can't be selected");
  }
  if (offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
    throw new ConflictError("This offer has expired");
  }

  // Swap the selection atomically: demote any currently selected offer on this
  // BOQ back to approved, then mark the chosen one selected.
  await db.transaction(async (tx) => {
    await tx
      .update(Offers)
      .set({ status: "approved", selectedAt: null })
      .where(and(eq(Offers.boqUuid, boqUuid), eq(Offers.status, "selected")));

    await tx
      .update(Offers)
      .set({ status: "selected", selectedAt: new Date() })
      .where(eq(Offers.uuid, offerUuid));
  });
};
