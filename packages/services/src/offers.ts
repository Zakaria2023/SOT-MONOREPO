import { and, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { BoqPartners } from "../../../db/schema/boq-partners";
import { Boqs } from "../../../db/schema/boqs";
import { Offers, SelectOffers } from "../../../db/schema/offers";
import { PartnerRequests } from "../../../db/schema/partner-requests";
import { Users } from "../../../db/schema/users";

export type { SelectOffers };

export type ApprovedPartner = {
  partnerRequestUuid: string;
  name: string;
  serviceScope: string;
};

export type CreateOfferInput = {
  partnerClerkUserId: string;
  boqUuid: string;
  productPrice: string;
  installPrice: string;
  programmingPrice?: string;
  description: string;
};

export type OfferReviewInput = {
  offerUuid: string;
  reviewedByClerkUserId?: string | null;
  reviewedByName?: string | null;
};

export type RejectOfferInput = OfferReviewInput & {
  rejectionReason: string;
};

/** An offer enriched with its BOQ reference and customer (admin list). */
export type OfferListItem = SelectOffers & {
  boqReference: string | null;
  customerName: string | null;
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

  if (!row) return null;
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
  if (!dispatch) throw new Error("This BOQ was not sent to you");

  const partner = await getApprovedPartnerByClerkId(input.partnerClerkUserId);
  if (!partner) throw new Error("Partner profile not found");

  const programmingPrice =
    partner.serviceScope === "install-program"
      ? input.programmingPrice
      : undefined;
  if (
    partner.serviceScope === "install-program" &&
    (!programmingPrice || programmingPrice.length === 0)
  ) {
    throw new Error("Programming price is required");
  }

  const existing = await getPartnerOffer(
    input.partnerClerkUserId,
    input.boqUuid,
  );
  if (
    existing &&
    (existing.status === "approved" || existing.status === "selected")
  ) {
    throw new Error("Your offer has already been approved and can't be changed");
  }

  const values = {
    partnerRequestUuid: partner.partnerRequestUuid,
    partnerName: partner.name,
    serviceScope: partner.serviceScope,
    productPrice: input.productPrice,
    installPrice: input.installPrice,
    programmingPrice: programmingPrice ?? null,
    description: input.description.trim(),
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
    if (!updated) throw new Error("Failed to save offer");
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
  if (!created) throw new Error("Failed to save offer");
  return created;
};

/** Every offer with its BOQ reference and customer name (admin review). */
export const listOffers = async (): Promise<OfferListItem[]> =>
  db
    .select({
      ...getTableColumns(Offers),
      boqReference: Boqs.reference,
      customerName: Users.fullName,
    })
    .from(Offers)
    .leftJoin(Boqs, eq(Offers.boqUuid, Boqs.uuid))
    .leftJoin(Users, eq(Boqs.userUuid, Users.uuid))
    .orderBy(desc(Offers.createdAt));

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
  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "pending") {
    throw new Error("This offer has already been reviewed");
  }

  await db
    .update(Offers)
    .set({
      status: "approved",
      rejectionReason: null,
      reviewedByClerkUserId,
      reviewedByName,
      approvedAt: new Date(),
      rejectedAt: null,
    })
    .where(eq(Offers.uuid, offerUuid));
};

/** Rejects a pending offer with a reason. */
export const rejectOffer = async ({
  offerUuid,
  rejectionReason,
  reviewedByClerkUserId = null,
  reviewedByName = null,
}: RejectOfferInput): Promise<void> => {
  const offer = await getOfferByUuid(offerUuid);
  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "pending") {
    throw new Error("This offer has already been reviewed");
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
  boqReference: string | null;
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
): Promise<SelectOffers[]> => {
  const boq = await getOwnedBoq(userUuid, boqUuid);
  if (!boq) return [];

  return db
    .select()
    .from(Offers)
    .where(
      and(
        eq(Offers.boqUuid, boqUuid),
        inArray(Offers.status, ["approved", "selected"]),
      ),
    )
    .orderBy(desc(Offers.status), Offers.createdAt);
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
  if (!boq) throw new Error("BOQ not found");

  const offer = await getOfferByUuid(offerUuid);
  if (!offer || offer.boqUuid !== boqUuid) {
    throw new Error("Offer not found");
  }
  if (offer.status !== "approved" && offer.status !== "selected") {
    throw new Error("This offer can't be selected");
  }

  // Reset any previously selected offer on this BOQ back to approved.
  await db
    .update(Offers)
    .set({ status: "approved", selectedAt: null })
    .where(and(eq(Offers.boqUuid, boqUuid), eq(Offers.status, "selected")));

  await db
    .update(Offers)
    .set({ status: "selected", selectedAt: new Date() })
    .where(eq(Offers.uuid, offerUuid));
};
