import type { SelectLeads } from "../../../db/schema/leads";

// ---------------------------------------------------------------------------
// 7.3 — QUALIFICATION IS RULES, NEVER A SCORE.
//
// The gate: a lead is not released to a partner until it is qualified. Everything
// here exists because of what happens when it is skipped — a partner sent four
// tyre-kickers stops opening the feed, and the fifth, which was real, goes nowhere.
// The channel then has negative value: it has cost SOT the partner's attention.
//
// SO WHY NOT A SCORE? Because a number cannot be acted on by either side. "62" does
// not tell whoever is qualifying which question to ask next, and it does not tell a
// partner what they are being handed. It also invites a threshold, and a threshold
// invites nudging a 58 up to a 60 to clear the queue.
//
// Four facts, each either present or absent, each named when it is missing:
//
//   WHAT      which system — an enquiry with no system named is a conversation
//   HOW BIG   a band, because nobody enquiring knows their camera count
//   WHERE     routing needs somewhere to route to
//   REAL      has anybody actually spoken to them
//
// The fourth is the one that does the work. The first three can be filled in by a
// form; only a human confirms there is a person at the other end.
//
// Pure.
// ---------------------------------------------------------------------------

export type QualificationGap = {
  field: "systems" | "sizeBand" | "location" | "contact";
  // What to go and find out, in the words of whoever has to do it.
  ask: string;
};

export type Qualification = {
  qualified: boolean;
  missing: QualificationGap[];
  // Present and readable, for the queue. Never a score — a count of gaps is a
  // count of things to do, not a rating of the lead.
  summary: string;
};

export type QualifiableLead = Pick<
  SelectLeads,
  "systems" | "sizeBand" | "city" | "contactVerifiedAt" | "contactPhone" | "contactEmail"
>;

const GAPS: {
  field: QualificationGap["field"];
  ask: string;
  present: (lead: QualifiableLead) => boolean;
}[] = [
  {
    field: "systems",
    ask: "Which system do they want — cameras, alarm, access, network?",
    present: (lead) => (lead.systems ?? []).length > 0,
  },
  {
    field: "sizeBand",
    ask: "Roughly how big is it? A band is enough — a villa, a floor, a compound.",
    present: (lead) => (lead.sizeBand ?? "").trim() !== "",
  },
  {
    field: "location",
    // A city is the minimum. Coordinates make the routing better and are not
    // required: a lead that can only be routed by city is still a routable lead,
    // and demanding a pin would strand every enquiry taken over the phone.
    ask: "Where is the site? A city is enough to route it.",
    present: (lead) => (lead.city ?? "").trim() !== "",
  },
  {
    field: "contact",
    // THE ONE THAT MATTERS. A form fill is not a person, and this is the only fact
    // here that a machine cannot supply.
    ask: "Has anybody actually spoken to them, and is there a phone or an email that works?",
    present: (lead) =>
      lead.contactVerifiedAt !== null &&
      ((lead.contactPhone ?? "").trim() !== "" ||
        (lead.contactEmail ?? "").trim() !== ""),
  },
];

/** Whether this lead may be offered to anybody, and what is missing if not. */
export const qualifyLead = (lead: QualifiableLead): Qualification => {
  const missing = GAPS.filter((gap) => !gap.present(lead)).map((gap) => ({
    field: gap.field,
    ask: gap.ask,
  }));

  return {
    qualified: missing.length === 0,
    missing,
    summary:
      missing.length === 0
        ? "Qualified — ready to offer."
        : `Still needed: ${missing.map((gap) => gap.field === "location" ? "location" : gap.field === "contact" ? "a verified contact" : gap.field).join(", ")}.`,
  };
};

// ---------------------------------------------------------------------------
// Routing.
// ---------------------------------------------------------------------------

export type RoutablePartner = {
  clerkUserId: string;
  name: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  // What they are certified and approved to do. A lead for a fire system offered to
  // a partner who cannot install one wastes both sides' time, and it is the fastest
  // way to teach a partner that the feed is noise.
  capabilities: string[];
};

export type RoutedPartner = RoutablePartner & {
  // Kilometres, when both ends have coordinates. Null when the match is by city
  // alone — and null is NOT infinity: a same-city partner with no pin must not sort
  // below a partner 400 km away who happens to have one.
  distanceKm: number | null;
  sameCity: boolean;
};

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Great-circle distance.
 *
 * Haversine rather than a flat approximation. Saudi Arabia is 2,000 km across and
 * a planar shortcut is out by tens of kilometres at that range — which is enough to
 * reorder who gets offered a job.
 */
export const distanceKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

export type RoutingInput = {
  lead: Pick<SelectLeads, "city" | "latitude" | "longitude" | "systems">;
  partners: RoutablePartner[];
  // Which capability a partner needs to be handed this lead. Passed in rather than
  // inferred from `systems`, because mapping a marketing word like "cameras" onto a
  // capability is a business decision and not a string match.
  requiredCapability: string;
};

/**
 * Who to offer it to, nearest first.
 *
 * Capability is a FILTER and distance is an ORDER. That is deliberate: being close
 * does not make a partner able to install a fire panel, so proximity can never
 * promote somebody past the filter. The same separation the matching engine already
 * uses for BOQs.
 *
 * Same city outranks raw distance. A partner in the same city with no coordinates
 * on file is a better offer than one 300 km away who happens to have a pin, and
 * sorting purely on a nullable number would get that backwards.
 */
export const routeLead = ({
  lead,
  partners,
  requiredCapability,
}: RoutingInput): RoutedPartner[] => {
  const leadLat = lead.latitude === null ? null : Number(lead.latitude);
  const leadLon = lead.longitude === null ? null : Number(lead.longitude);
  const leadHasPin =
    leadLat !== null &&
    leadLon !== null &&
    Number.isFinite(leadLat) &&
    Number.isFinite(leadLon);

  const leadCity = (lead.city ?? "").trim().toLowerCase();

  return partners
    .filter((partner) => partner.capabilities.includes(requiredCapability))
    .map((partner) => {
      const sameCity =
        leadCity !== "" && (partner.city ?? "").trim().toLowerCase() === leadCity;

      const partnerHasPin =
        partner.latitude !== null &&
        partner.longitude !== null &&
        Number.isFinite(partner.latitude) &&
        Number.isFinite(partner.longitude);

      return {
        ...partner,
        sameCity,
        distanceKm:
          leadHasPin && partnerHasPin
            ? distanceKm(
                { latitude: leadLat, longitude: leadLon },
                {
                  latitude: partner.latitude as number,
                  longitude: partner.longitude as number,
                },
              )
            : null,
      };
    })
    .sort((a, b) => {
      // Same city first, whatever the numbers say.
      if (a.sameCity !== b.sameCity) {
        return a.sameCity ? -1 : 1;
      }
      // Then by distance, with unknown distance last rather than treated as zero.
      const aKm = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const bKm = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (aKm !== bKm) {
        return aKm - bKm;
      }
      // A stable tie-break, so two runs of the same routing produce the same order
      // and the cascade does not shuffle.
      return a.clerkUserId.localeCompare(b.clerkUserId);
    });
};
