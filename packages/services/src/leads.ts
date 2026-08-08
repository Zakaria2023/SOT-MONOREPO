import { and, asc, desc, eq, getTableColumns, inArray, lte, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type { PartnerCapability } from "../../../db/enum";
import {
  LeadOffers,
  Leads,
  type SelectLeadOffers,
  type SelectLeads,
} from "../../../db/schema/leads";
import { PartnerRequests } from "../../../db/schema/partner-requests";
import { Certifications } from "../../../db/schema/training";
import { capabilityStanding } from "./certification-gate";
import { ConflictError, ValidationError } from "./errors";
import {
  qualifyLead,
  routeLead,
  type Qualification,
  type RoutablePartner,
  type RoutedPartner,
} from "./lead-qualification";
import { notify } from "./notifications";

export type { SelectLeadOffers, SelectLeads };

// ---------------------------------------------------------------------------
// 7.3 — CAPTURING, QUALIFYING, ROUTING.
//
// `lead-qualification.ts` holds the rules; this holds the reads and writes and the
// cascade.
//
// THE CASCADE IS THE PART THAT NEEDS CARE. An offer with a clock on it is only
// worth having if the clock does something when it runs out — otherwise `expiresAt`
// joins `Products.status` and `Certifications.expiresOn` in the list of columns
// nothing reads. There is no scheduler here, so `sweepExpiredOffers` is called
// whenever the queue is read: the state a screen shows is always the state after
// expiry has been applied, which means nobody ever sees a lapsed offer presented as
// live.
// ---------------------------------------------------------------------------

// How long a partner has to take a lead before it moves on. Two working days in
// hours. Short enough that a customer is not left waiting a week, long enough that
// a partner who is on site on Tuesday has not lost it by Wednesday morning.
export const OFFER_HOURS = 48;

export type LeadRow = SelectLeads & {
  qualification: Qualification;
  // Live offers, so the queue can say who has it. Aggregates.
  offerCount: number;
  currentPartnerName: string | null;
};

export type LeadOfferRow = SelectLeadOffers & {
  leadReference: SelectLeads["reference"];
  city: SelectLeads["city"];
  systems: SelectLeads["systems"];
  sizeBand: SelectLeads["sizeBand"];
  status: SelectLeadOffers["status"];
  // Only revealed on an ACCEPTED offer — see `listPartnerOffers`.
  contactName: SelectLeads["contactName"] | null;
  contactPhone: SelectLeads["contactPhone"] | null;
  contactEmail: SelectLeads["contactEmail"] | null;
  enquiry: SelectLeads["enquiry"] | null;
};

export type CaptureLeadInput = {
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  source?: string | null;
  enquiry?: string | null;
  systems?: string[] | null;
  sizeBand?: string | null;
  city?: string | null;
};

/** Take an enquiry in. Deliberately permissive — qualification comes later. */
export const captureLead = async (
  input: CaptureLeadInput,
): Promise<SelectLeads> => {
  const contactName = input.contactName.trim();
  if (contactName === "") {
    throw new ValidationError("A lead needs a name.");
  }
  if (!input.contactPhone?.trim() && !input.contactEmail?.trim()) {
    // The one thing an enquiry cannot arrive without. Everything else can be
    // established later; a lead with no way to reach anybody is not a lead.
    throw new ValidationError("A lead needs a phone number or an email.");
  }

  const uuid = generateUuid();
  await db.insert(Leads).values({
    uuid,
    reference: `LEAD-${uuid.slice(0, 8).toUpperCase()}`,
    contactName,
    contactPhone: input.contactPhone?.trim() || null,
    contactEmail: input.contactEmail?.trim() || null,
    source: input.source?.trim() || null,
    enquiry: input.enquiry?.trim() || null,
    systems: input.systems?.length ? input.systems : null,
    sizeBand: input.sizeBand?.trim() || null,
    city: input.city?.trim() || null,
  });

  const [row] = await db.select().from(Leads).where(eq(Leads.uuid, uuid));
  if (!row) {
    throw new Error("Failed to capture that lead");
  }
  return row;
};

export type QualifyInput = {
  leadUuid: string;
  systems?: string[] | null;
  sizeBand?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactVerified?: boolean;
  actorName: string;
};

/**
 * Fill in the qualification facts, and mark it qualified once they are all there.
 *
 * The status only moves when `qualifyLead` says every fact is present. There is no
 * way to mark a lead qualified by hand, because the whole value of the gate is that
 * it cannot be waved through when the queue is long.
 */
export const qualifyLeadRecord = async (
  input: QualifyInput,
): Promise<{ lead: SelectLeads; qualification: Qualification }> => {
  const [existing] = await db
    .select()
    .from(Leads)
    .where(eq(Leads.uuid, input.leadUuid));
  if (!existing) {
    throw new ValidationError("That lead no longer exists.");
  }
  if (existing.status === "rejected") {
    throw new ConflictError("That lead was turned down.");
  }

  const merged = {
    ...existing,
    systems: input.systems === undefined ? existing.systems : input.systems,
    sizeBand: input.sizeBand === undefined ? existing.sizeBand : input.sizeBand,
    city: input.city === undefined ? existing.city : input.city,
    contactVerifiedAt: input.contactVerified
      ? (existing.contactVerifiedAt ?? new Date())
      : input.contactVerified === false
        ? null
        : existing.contactVerifiedAt,
  };

  const qualification = qualifyLead(merged);

  await db
    .update(Leads)
    .set({
      systems: merged.systems,
      sizeBand: merged.sizeBand,
      city: merged.city,
      latitude:
        input.latitude === undefined
          ? existing.latitude
          : input.latitude === null
            ? null
            : String(input.latitude),
      longitude:
        input.longitude === undefined
          ? existing.longitude
          : input.longitude === null
            ? null
            : String(input.longitude),
      contactVerifiedAt: merged.contactVerifiedAt,
      contactVerifiedBy: merged.contactVerifiedAt ? input.actorName : null,
      // Only moves to `qualified` when the rules say so, and never back from
      // `offered` — a lead already with a partner is not un-offered by somebody
      // editing a field.
      status:
        existing.status === "new" && qualification.qualified
          ? "qualified"
          : existing.status,
      qualifiedAt: qualification.qualified
        ? (existing.qualifiedAt ?? new Date())
        : null,
      qualifiedBy: qualification.qualified ? input.actorName : null,
    })
    .where(eq(Leads.uuid, input.leadUuid));

  const [lead] = await db
    .select()
    .from(Leads)
    .where(eq(Leads.uuid, input.leadUuid));
  if (!lead) {
    throw new Error("Failed to qualify that lead");
  }
  return { lead, qualification };
};

export const rejectLead = async (
  leadUuid: string,
  reason: string,
): Promise<void> => {
  if (reason.trim() === "") {
    throw new ValidationError(
      "Say why — the reason is what stops the same enquiry being chased again next month.",
    );
  }
  await db
    .update(Leads)
    .set({ status: "rejected", rejectedReason: reason.trim() })
    .where(eq(Leads.uuid, leadUuid));
};

// ---------------------------------------------------------------------------
// Routing and the cascade.
// ---------------------------------------------------------------------------

/**
 * Approved partners, with the capabilities they may ACTUALLY exercise today.
 *
 * The stored `capabilities` array is a record of grants, not of entitlement. A
 * partner granted `install_only` last year still has it in that array after their
 * certificate lapsed, because nothing runs at midnight to take it out — so routing
 * read straight from the array would offer a fire job to somebody who is no longer
 * certified for one. The drive caught exactly that.
 *
 * So every certified capability is re-derived from the certificates, at today's
 * date, by the same function that guards `grantCapability`. Commercial capabilities
 * pass through untouched, because there is no certificate to check.
 *
 * One read for all certificates rather than one per partner — the pool is shared
 * across five apps and a routing pass is not the place to fan out.
 */
const approvedPartners = async (): Promise<RoutablePartner[]> => {
  const today = new Date().toISOString().slice(0, 10);

  const certificates = await db
    .select({
      uuid: Certifications.uuid,
      partnerClerkUserId: Certifications.partnerClerkUserId,
      capability: Certifications.capability,
      status: Certifications.status,
      expiresOn: Certifications.expiresOn,
      verifiedAt: Certifications.verifiedAt,
    })
    .from(Certifications);

  const certsByPartner = new Map<string, typeof certificates>();
  for (const certificate of certificates) {
    const list = certsByPartner.get(certificate.partnerClerkUserId) ?? [];
    list.push(certificate);
    certsByPartner.set(certificate.partnerClerkUserId, list);
  }

  const rows = await db
    .select({
      clerkUserId: PartnerRequests.approvedClerkUserId,
      // An individual partner has no company name, so the person's name is the
      // fallback rather than a blank in the queue.
      companyName: PartnerRequests.companyName,
      fullName: PartnerRequests.fullName,
      // `location` is what the application form asks for — one free-text field, not
      // a city column. Matched against the lead's city by the router, which folds
      // case and trims; anything more (a geocoder, an address parser) is a bigger
      // decision than routing needs to make today.
      location: PartnerRequests.location,
      capabilities: PartnerRequests.capabilities,
    })
    .from(PartnerRequests)
    .where(eq(PartnerRequests.status, "approved"));

  return rows.flatMap((row) =>
    row.clerkUserId === null
      ? []
      : [
          {
            clerkUserId: row.clerkUserId,
            name: row.companyName ?? row.fullName,
            city: row.location,
            // No coordinates on a partner record yet. Left explicit rather than
            // faked: routing falls back to city, which the pure router handles, and
            // the day partners carry a pin this is the only line that changes.
            latitude: null,
            longitude: null,
            // Filtered to what they may exercise TODAY, not what they were once
            // granted.
            capabilities: ((row.capabilities ?? []) as PartnerCapability[]).filter(
              (capability) =>
                capabilityStanding(
                  capability,
                  certsByPartner.get(row.clerkUserId as string) ?? [],
                  today,
                ).allowed,
            ),
          },
        ],
  );
};

/** Who this lead would go to, in order — without offering it to anybody. */
export const previewRouting = async (
  leadUuid: string,
  requiredCapability: PartnerCapability,
): Promise<RoutedPartner[]> => {
  const [lead] = await db.select().from(Leads).where(eq(Leads.uuid, leadUuid));
  if (!lead) {
    throw new ValidationError("That lead no longer exists.");
  }
  return routeLead({
    lead,
    partners: await approvedPartners(),
    requiredCapability,
  });
};

/**
 * Offer a qualified lead to the next partner in line.
 *
 * THE GATE. A lead that has not been qualified is refused here, not filtered out of
 * a list — a screen can be bypassed and this cannot.
 *
 * Partners already offered it are skipped, so calling this again is the cascade
 * rather than a repeat.
 */
export const offerLead = async ({
  leadUuid,
  requiredCapability,
}: {
  leadUuid: string;
  requiredCapability: PartnerCapability;
}): Promise<SelectLeadOffers> => {
  await sweepExpiredOffers();

  const [lead] = await db.select().from(Leads).where(eq(Leads.uuid, leadUuid));
  if (!lead) {
    throw new ValidationError("That lead no longer exists.");
  }

  const qualification = qualifyLead(lead);
  if (!qualification.qualified) {
    throw new ValidationError(
      `This lead is not qualified yet. ${qualification.summary} Partners stop trusting the feed after a handful of unqualified leads.`,
    );
  }
  if (lead.status === "accepted" || lead.status === "converted") {
    throw new ConflictError("A partner has already taken this lead on.");
  }

  const previous = await db
    .select({
      partnerClerkUserId: LeadOffers.partnerClerkUserId,
      status: LeadOffers.status,
      cascadeRound: LeadOffers.cascadeRound,
    })
    .from(LeadOffers)
    .where(eq(LeadOffers.leadUuid, leadUuid));

  const live = previous.find((offer) => offer.status === "offered");
  if (live) {
    throw new ConflictError(
      "This lead is already with a partner. It cascades on its own when their time runs out.",
    );
  }

  const tried = new Set(previous.map((offer) => offer.partnerClerkUserId));
  const queue = routeLead({
    lead,
    partners: await approvedPartners(),
    requiredCapability,
  }).filter((partner) => !tried.has(partner.clerkUserId));

  if (queue.length === 0) {
    throw new ConflictError(
      tried.size === 0
        ? `No approved partner holds the ${requiredCapability} capability, so there is nobody to offer this to.`
        : "Every qualifying partner has already been offered this lead.",
    );
  }

  const next = queue[0];
  const uuid = generateUuid();
  const expiresAt = new Date(Date.now() + OFFER_HOURS * 60 * 60 * 1000);
  const cascadeRound =
    previous.reduce((highest, offer) => Math.max(highest, offer.cascadeRound), 0) + 1;

  await db.transaction(async (tx) => {
    await tx.insert(LeadOffers).values({
      uuid,
      leadUuid,
      partnerClerkUserId: next.clerkUserId,
      partnerName: next.name,
      cascadeRound,
      expiresAt,
    });
    await tx
      .update(Leads)
      .set({ status: "offered" })
      .where(eq(Leads.uuid, leadUuid));
  });

  await notify({
    audience: "client",
    kind: "lead",
    recipientClerkUserId: next.clerkUserId,
    title: `A new lead in ${lead.city ?? "your area"}`,
    // The contact details are NOT in here. They are released on acceptance — see
    // listPartnerOffers.
    body: `${(lead.systems ?? []).join(", ") || "A system"}, ${lead.sizeBand ?? "size to be confirmed"}. You have ${OFFER_HOURS} hours before it moves on.`,
    href: "/leads",
  });

  const [offer] = await db
    .select()
    .from(LeadOffers)
    .where(eq(LeadOffers.uuid, uuid));
  if (!offer) {
    throw new Error("Failed to offer that lead");
  }
  return offer;
};

/**
 * Lapse every offer whose clock has run out.
 *
 * Called at the top of every read and every offer, because there is no scheduler.
 * That is not a workaround — it means the state any screen shows is the state after
 * expiry, so a lapsed offer is never presented as live. A nightly job would leave a
 * window in which it was.
 *
 * The lead goes back to `qualified` rather than to `new`: it was qualified once, and
 * a partner not answering is not evidence about the customer.
 */
export const sweepExpiredOffers = async (): Promise<number> => {
  const stale = await db
    .select({ uuid: LeadOffers.uuid, leadUuid: LeadOffers.leadUuid })
    .from(LeadOffers)
    .where(
      and(eq(LeadOffers.status, "offered"), lte(LeadOffers.expiresAt, new Date())),
    );
  if (stale.length === 0) {
    return 0;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(LeadOffers)
      .set({ status: "expired" })
      .where(
        inArray(
          LeadOffers.uuid,
          stale.map((offer) => offer.uuid),
        ),
      );

    // Only the leads still sitting at `offered`. One that was accepted in the
    // meantime must not be dragged backwards by a sibling offer lapsing.
    await tx
      .update(Leads)
      .set({ status: "qualified" })
      .where(
        and(
          inArray(
            Leads.uuid,
            stale.map((offer) => offer.leadUuid),
          ),
          eq(Leads.status, "offered"),
        ),
      );
  });

  return stale.length;
};

/** A partner takes it on. */
export const acceptLeadOffer = async ({
  offerUuid,
  partnerClerkUserId,
}: {
  offerUuid: string;
  partnerClerkUserId: string;
}): Promise<void> => {
  await sweepExpiredOffers();

  // Guarded in the WHERE on both the owner and the status. A partner accepting an
  // offer that lapsed a minute ago, or somebody else's offer, both fail here rather
  // than in a check that read first.
  const result = await db
    .update(LeadOffers)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(
      and(
        eq(LeadOffers.uuid, offerUuid),
        eq(LeadOffers.partnerClerkUserId, partnerClerkUserId),
        eq(LeadOffers.status, "offered"),
      ),
    );

  const affected = (result as unknown as { affectedRows?: number }[])[0]
    ?.affectedRows;
  if (affected === 0) {
    throw new ConflictError(
      "That offer is no longer open — it may have run out of time and moved on.",
    );
  }

  const [offer] = await db
    .select({ leadUuid: LeadOffers.leadUuid, partnerName: LeadOffers.partnerName })
    .from(LeadOffers)
    .where(eq(LeadOffers.uuid, offerUuid));
  if (offer) {
    await db
      .update(Leads)
      .set({ status: "accepted" })
      .where(eq(Leads.uuid, offer.leadUuid));

    await notify({
      audience: "admin",
      kind: "lead",
      title: `${offer.partnerName ?? "A partner"} has taken a lead on`,
      href: "/leads",
    });
  }
};

/** A partner passes. Cascades immediately rather than waiting for the clock. */
export const declineLeadOffer = async ({
  offerUuid,
  partnerClerkUserId,
  reason,
}: {
  offerUuid: string;
  partnerClerkUserId: string;
  reason: string;
}): Promise<void> => {
  const result = await db
    .update(LeadOffers)
    .set({
      status: "declined",
      respondedAt: new Date(),
      declinedReason: reason.trim() || null,
    })
    .where(
      and(
        eq(LeadOffers.uuid, offerUuid),
        eq(LeadOffers.partnerClerkUserId, partnerClerkUserId),
        eq(LeadOffers.status, "offered"),
      ),
    );

  const affected = (result as unknown as { affectedRows?: number }[])[0]
    ?.affectedRows;
  if (affected === 0) {
    throw new ConflictError("That offer is no longer open.");
  }

  const [offer] = await db
    .select({ leadUuid: LeadOffers.leadUuid })
    .from(LeadOffers)
    .where(eq(LeadOffers.uuid, offerUuid));
  if (offer) {
    // Back to qualified, ready for the next round. A decline says nothing about the
    // customer.
    await db
      .update(Leads)
      .set({ status: "qualified" })
      .where(
        and(eq(Leads.uuid, offer.leadUuid), eq(Leads.status, "offered")),
      );
  }
};

/** Record that a lead turned into work. */
export const markLeadConverted = async ({
  leadUuid,
  boqUuid,
}: {
  leadUuid: string;
  boqUuid: string | null;
}): Promise<void> => {
  await db
    .update(Leads)
    .set({
      status: "converted",
      convertedBoqUuid: boqUuid,
      convertedAt: new Date(),
    })
    .where(eq(Leads.uuid, leadUuid));
};

export const markLeadLost = async (
  leadUuid: string,
  reason: string,
): Promise<void> => {
  await db
    .update(Leads)
    .set({ status: "lost", lostReason: reason.trim() || null })
    .where(eq(Leads.uuid, leadUuid));
};

/** The lead desk. Sweeps first, so nothing lapsed is shown as live. */
export const listLeads = async (): Promise<LeadRow[]> => {
  await sweepExpiredOffers();

  // THE IDENTIFIERS ARE WRITTEN OUT, TABLE-QUALIFIED, RATHER THAN INTERPOLATED.
  //
  // Drizzle only qualifies a column reference when the query has a join; a
  // single-table select renders `${Leads.uuid}` as a bare `uuid`. Inside these
  // sub-queries that bare name resolves to `LeadOffers.uuid` — the sub-query's OWN
  // column — so the correlation became `LeadOffers.lead_uuid = LeadOffers.uuid`,
  // which is never true. Every count came back 0 and every partner name null, on a
  // page that looked entirely plausible.
  //
  // Caught by driving it against real rows: an accepted offer showed as "0 offers".
  // Nothing about the query errors, and nothing about the output looks wrong unless
  // you know what the number should be.
  const rows = await db
    .select({
      ...getTableColumns(Leads),
      offerCount: sql<number>`(
        SELECT COUNT(*) FROM \`LeadOffers\`
        WHERE \`LeadOffers\`.\`lead_uuid\` = \`Leads\`.\`uuid\`
      )`.mapWith(Number),
      currentPartnerName: sql<string | null>`(
        SELECT \`LeadOffers\`.\`partner_name\` FROM \`LeadOffers\`
        WHERE \`LeadOffers\`.\`lead_uuid\` = \`Leads\`.\`uuid\`
          AND \`LeadOffers\`.\`status\` IN ('offered','accepted')
        ORDER BY \`LeadOffers\`.\`created_at\` DESC LIMIT 1
      )`,
    })
    .from(Leads)
    .orderBy(desc(Leads.createdAt));

  return rows.map((row) => ({ ...row, qualification: qualifyLead(row) }));
};

/**
 * A partner's own lead feed.
 *
 * THE CONTACT DETAILS ARE WITHHELD UNTIL THEY ACCEPT. A partner deciding whether to
 * take a job needs the system, the size and the city; they do not need the
 * customer's phone number, and handing it over at the offer stage means a lead can
 * be worked without ever being accepted — which loses SOT the record of who did what
 * and loses the customer any accountability.
 */
export const listPartnerOffers = async (
  partnerClerkUserId: string,
): Promise<LeadOfferRow[]> => {
  await sweepExpiredOffers();

  const rows = await db
    .select({
      ...getTableColumns(LeadOffers),
      leadReference: Leads.reference,
      city: Leads.city,
      systems: Leads.systems,
      sizeBand: Leads.sizeBand,
      contactName: Leads.contactName,
      contactPhone: Leads.contactPhone,
      contactEmail: Leads.contactEmail,
      enquiry: Leads.enquiry,
    })
    .from(LeadOffers)
    .innerJoin(Leads, eq(LeadOffers.leadUuid, Leads.uuid))
    .where(eq(LeadOffers.partnerClerkUserId, partnerClerkUserId))
    .orderBy(asc(LeadOffers.status), desc(LeadOffers.createdAt));

  return rows.map((row) =>
    row.status === "accepted"
      ? row
      : {
          ...row,
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          enquiry: null,
        },
  );
};
