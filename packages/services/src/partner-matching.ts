import type { PartnerCapability } from "../../../db/enum";

// ---------------------------------------------------------------------------
// 5.1 — MATCHING A JOB TO A PARTNER.
//
// The plan flagged this as the one genuinely undesigned piece. What existed
// ranked approved partners by how close their city string looked to the
// customer's — and stopped there. It never asked whether the partner could DO
// the work, so a pre-seller with no installation capability sorted top of the
// list for an installation job purely for being in the right city.
//
// Two rules, in this order, and deliberately no third:
//
//   CAPABILITY IS A FILTER, NOT A SCORE. Either they may do the work or they may
//   not. Blending it into a ranking means a very close partner who cannot do the
//   job outranks a slightly further one who can, and somebody assigns it.
//
//   PROXIMITY IS THE RANKING, and only among those who passed the filter.
//
// Explicitly NOT machine learning, and not a weighted blend of ten signals. A
// match nobody can explain is a match nobody can defend to the partner who did
// not get the job — so every result carries why it ranked where it did, and an
// ineligible partner is returned WITH the reason rather than silently dropped.
//
// All pure. Matching is the decision most likely to be argued about, and one
// that cannot be examined without a database is one nobody can check.
// ---------------------------------------------------------------------------

export type Proximity = "same_city" | "shares_region" | "elsewhere" | "unknown";

export type PartnerCandidate = {
  partnerRequestUuid: string;
  clerkUserId: string;
  name: string;
  // A partner always has one — the column is NOT NULL, and an approved partner
  // with nowhere to work would not have been approved. The asymmetry with the
  // JOB's location below is deliberate and not an oversight.
  location: string;
  capabilities: PartnerCapability[];
  // Ties break toward the longer-standing partner, so the order is stable rather
  // than arbitrary.
  approvedAt: Date;
};

export type MatchRequirement = {
  // Where the work is. Null when the customer never set one — a real state, and
  // reported rather than guessed at.
  location: string | null;
  // ANY ONE of these qualifies. A job needing installation is served by
  // `install_only` or `install_program`, and requiring all of them would match
  // nobody.
  needsAnyOf: PartnerCapability[];
};

export type PartnerMatch = {
  candidate: PartnerCandidate;
  eligible: boolean;
  // Null when eligible. An explanation for something that worked is noise.
  reason: string | null;
  proximity: Proximity;
  // 1-based among the eligible, closest first. 0 for anyone filtered out.
  rank: number;
};

export type MatchOutcome = {
  // Ranked, closest first.
  eligible: PartnerMatch[];
  // Filtered out, each with why. Kept so whoever is assigning can see that a
  // partner they expected WAS considered — a name simply missing reads as a bug
  // in the matcher.
  ineligible: PartnerMatch[];
  // True when the job's location is unknown, so nothing could be ranked by
  // distance and the order is by standing alone. Surfaced rather than hidden
  // behind a list that looks confidently sorted.
  unranked: boolean;
};

/**
 * Location as comparable parts.
 *
 * Split on commas and slashes, trimmed, lowercased. Deliberately crude: these
 * are free-text strings a person typed, and anything cleverer — fuzzy matching,
 * a gazetteer — would silently pair "Riyadh" with "Riyadh Province" in one
 * direction and not the other.
 */
export const locationParts = (location: string | null): string[] =>
  (location ?? "")
    .split(/[,/]/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

/**
 * How close two locations are.
 *
 * The FIRST part is treated as the city, because that is how people write an
 * address here — "Riyadh, Al Olaya" not "Al Olaya, Riyadh". Sharing any later
 * part is a region match: worth ranking above a stranger, never worth calling
 * the same city.
 */
export const proximityOf = (
  jobLocation: string | null,
  partnerLocation: string | null,
): Proximity => {
  const job = locationParts(jobLocation);
  const partner = locationParts(partnerLocation);
  if (job.length === 0 || partner.length === 0) {
    return "unknown";
  }
  if (job[0] === partner[0]) {
    return "same_city";
  }
  return partner.some((part) => job.includes(part))
    ? "shares_region"
    : "elsewhere";
};

const PROXIMITY_ORDER: Record<Proximity, number> = {
  same_city: 0,
  shares_region: 1,
  elsewhere: 2,
  unknown: 3,
};

const PROXIMITY_LABEL: Record<Proximity, string> = {
  same_city: "Same city",
  shares_region: "Shares part of the address",
  elsewhere: "Elsewhere",
  unknown: "No location on file",
};

export const describeProximity = (proximity: Proximity): string =>
  PROXIMITY_LABEL[proximity];

/**
 * Who can take this job, in the order they should be offered it.
 *
 * Capability first as a hard filter, then proximity, then standing. Nothing is
 * weighted against anything else — the moment two incomparable things share a
 * score, the result stops being explainable.
 */
export const matchPartners = (
  candidates: PartnerCandidate[],
  requirement: MatchRequirement,
): MatchOutcome => {
  const needed = requirement.needsAnyOf;

  const judged = candidates.map((candidate) => {
    const proximity = proximityOf(requirement.location, candidate.location);
    const qualifies =
      needed.length === 0 ||
      needed.some((capability) => candidate.capabilities.includes(capability));

    return {
      candidate,
      proximity,
      eligible: qualifies,
      reason: qualifies
        ? null
        : // Named, so whoever is assigning knows what to grant rather than
          // wondering why somebody is missing.
          `Needs ${needed.join(" or ")}, and holds ${
            candidate.capabilities.length > 0
              ? candidate.capabilities.join(", ")
              : "nothing"
          }.`,
      rank: 0,
    };
  });

  const eligible = judged
    .filter((entry) => entry.eligible)
    .sort(
      (a, b) =>
        PROXIMITY_ORDER[a.proximity] - PROXIMITY_ORDER[b.proximity] ||
        a.candidate.approvedAt.getTime() - b.candidate.approvedAt.getTime(),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    eligible,
    ineligible: judged.filter((entry) => !entry.eligible),
    unranked: locationParts(requirement.location).length === 0,
  };
};
