import type {
  CertificateStanding,
  PartnerCapability,
} from "../../../db/enum";
import type { SelectCertifications } from "../../../db/schema/training";
import { daysBetween, parseDate } from "./service-schedule";

// ---------------------------------------------------------------------------
// 7.1 / 7.2 — THE TWO GATES, AND WHY THEY ARE SEPARATE.
//
// A9 and P2 were blocked on how a partner earns a capability. The route is
// attend → assess → certified → granted, and this file is the two places that
// chain is allowed to refuse.
//
// GATE ONE: A PASS, NOT ATTENDANCE. `canCertify` reads the assessment score and
// never `attendedAt`. Somebody who sat in a room for a day has demonstrated that
// they can sit in a room, and a certificate issued for that is worth nothing to
// the customer whose fire system they go on to install. This is the gate the spec
// states outright: certification issues on a completed assessment, not on
// attendance alone.
//
// GATE TWO: A VALID, VERIFIED CERTIFICATE. `capabilityStanding` decides whether a
// partner may hold a capability at all. Three ways to fail it, and each is a
// different sentence:
//
//   nothing        no certificate for this capability exists
//   unverified     one exists and SOT has never looked at it
//   expired        one exists, was verified, and has lapsed
//
// EXPIRY IS DERIVED, NEVER READ FROM THE COLUMN. `Certifications.status` can say
// `verified` on a certificate that lapsed last month, because nothing runs at
// midnight to change it. So standing is computed from the DATE every time it is
// asked. The stored status is for recording when a lapse was noticed and telling
// somebody — it is never the authority. Trusting the column is exactly how
// `Products.status` came to hold `out_of_stock` on products that were being sold.
//
// NOT EVERY CAPABILITY NEEDS A CERTIFICATE, which is the part that stops this
// being bureaucracy. Holding stock is a commercial arrangement; installing a fire
// system is a competence. Requiring paper for the first would block a distributor
// for no reason anybody could defend.
//
// All pure.
// ---------------------------------------------------------------------------

// WHICH CAPABILITIES REQUIRE PROOF OF COMPETENCE.
//
// A total map rather than a list, so adding a capability to the enum forces a
// decision here instead of defaulting to "no certificate needed" — which is the
// wrong default for anything safety-related and the direction a missing branch
// would silently fall.
export const REQUIRES_CERTIFICATION: Record<PartnerCapability, boolean> = {
  // Competence. Somebody programs a panel that has to work at four in the
  // morning.
  install_program: true,
  // Competence, and the one with a life-safety edge.
  install_only: true,
  // Designing a system is a technical judgement, and a bad one is discovered
  // months later on site.
  system_integrator: true,

  // COMMERCIAL, NOT TECHNICAL. Holding stock is a credit and warehousing
  // arrangement — there is no exam for it, and requiring one would block a
  // distributor for a reason nobody could defend.
  stock: false,
  // Selling and after-sales are trained through the partner relationship rather
  // than certified. Kept false deliberately: the day SOT wants an exam for these,
  // this line is where it goes.
  pre_sell: false,
  post_sell: false,
};

export type CertifyCheck =
  | { allowed: true; score: number }
  | { allowed: false; reason: string };

export type AssessmentFacts = {
  status: string;
  assessmentScore: number | null;
  passMark: number;
  hasAssessment: boolean;
  // What the course grants. A course granting nothing cannot produce a
  // certificate, which is not a failure — it is a course worth running for its own
  // sake.
  unlocksCapability: PartnerCapability | null;
};

/**
 * Whether a registration has earned a certificate.
 *
 * Reads the SCORE. `attendedAt` is deliberately not a parameter — a function that
 * cannot see attendance cannot be tempted to accept it.
 */
export const canCertify = (facts: AssessmentFacts): CertifyCheck => {
  if (facts.unlocksCapability === null) {
    return {
      allowed: false,
      reason: "This course does not grant a capability, so there is nothing to certify.",
    };
  }
  if (!facts.hasAssessment) {
    return {
      allowed: false,
      reason:
        "This course has no assessment. A capability cannot be granted on attendance alone.",
    };
  }
  if (facts.status === "cancelled" || facts.status === "no_show") {
    return {
      allowed: false,
      reason: `This registration is marked ${facts.status.replace("_", " ")}.`,
    };
  }
  if (facts.assessmentScore === null) {
    return {
      allowed: false,
      reason:
        "No assessment has been recorded. Attending is not passing, and a certificate on attendance alone is worth nothing to the customer.",
    };
  }
  if (facts.assessmentScore < facts.passMark) {
    return {
      allowed: false,
      reason: `Scored ${facts.assessmentScore}%, below the ${facts.passMark}% pass mark.`,
    };
  }
  return { allowed: true, score: facts.assessmentScore };
};

// Derived from `db/enum.ts` rather than declared here, so the label map and this
// cannot drift — and so a screen cannot render a stored `CertificationStatus` where
// a standing belongs. They looked interchangeable and are not.
export type { CertificateStanding };

export type CertificateState = {
  standing: CertificateStanding;
  daysUntilExpiry: number | null;
  // True inside the notice window below — the ones worth chasing before they go.
  lapsingSoon: boolean;
  reason: string;
};

// Sixty days. A partner has to book a course, sit it and be verified before the
// old certificate goes, and a fortnight's warning is a fortnight of the capability
// lapsing anyway.
export const LAPSE_NOTICE_DAYS = 60;

/**
 * One certificate's standing, computed from the date.
 *
 * The stored `status` is consulted only for `revoked`, which is a decision
 * somebody made and cannot be derived from anything. Everything else comes from
 * the dates, so a column left stale by the absence of a nightly job can never be
 * the reason a lapsed certificate is treated as live.
 */
export const certificateState = (
  certificate: Pick<
    SelectCertifications,
    "status" | "expiresOn" | "verifiedAt"
  >,
  today: string,
): CertificateState => {
  if (certificate.status === "revoked") {
    return {
      standing: "revoked",
      daysUntilExpiry: null,
      lapsingSoon: false,
      reason: "This certificate has been revoked.",
    };
  }

  if (certificate.verifiedAt === null) {
    return {
      standing: "unverified",
      daysUntilExpiry: null,
      lapsingSoon: false,
      reason:
        "SOT has not verified this certificate yet, so it does not unlock anything.",
    };
  }

  // Null expiry means it does not lapse. A real case for foundational training,
  // and the reason it is a null rather than a far-future date: the date would be a
  // lie that eventually surfaced as a false expiry warning.
  if (certificate.expiresOn === null) {
    return {
      standing: "valid",
      daysUntilExpiry: null,
      lapsingSoon: false,
      reason: "Verified, and does not expire.",
    };
  }

  const expires = parseDate(certificate.expiresOn);
  const now = parseDate(today);
  if (!expires || !now) {
    // An unreadable date is NOT treated as valid. A certificate whose expiry
    // nobody can read is a certificate nobody can rely on.
    return {
      standing: "expired",
      daysUntilExpiry: null,
      lapsingSoon: false,
      reason: `The expiry date on this certificate ("${certificate.expiresOn}") could not be read, so it cannot be relied on.`,
    };
  }

  const daysUntilExpiry = daysBetween(now, expires);
  if (daysUntilExpiry < 0) {
    return {
      standing: "expired",
      daysUntilExpiry,
      lapsingSoon: false,
      reason: `Expired on ${certificate.expiresOn}.`,
    };
  }

  return {
    standing: "valid",
    daysUntilExpiry,
    lapsingSoon: daysUntilExpiry <= LAPSE_NOTICE_DAYS,
    reason:
      daysUntilExpiry <= LAPSE_NOTICE_DAYS
        ? `Valid, but lapses on ${certificate.expiresOn} — ${daysUntilExpiry} days.`
        : `Valid until ${certificate.expiresOn}.`,
  };
};

export type CapabilityStanding = {
  capability: PartnerCapability;
  // Whether the partner may hold it.
  allowed: boolean;
  requiresCertification: boolean;
  // The certificate carrying it, when one does.
  certificateUuid: string | null;
  state: CertificateState | null;
  lapsingSoon: boolean;
  reason: string;
};

/**
 * May this partner hold this capability?
 *
 * Given every certificate they have, not just the ones for this capability — a
 * partner may hold two for the same thing (an expired one and its replacement),
 * and the answer has to be yes.
 *
 * The BEST certificate wins. Picking the newest would refuse a partner whose
 * renewal is verified because an older expired one sorts later by some other
 * field, and picking the first found makes the answer depend on row order.
 */
export const capabilityStanding = (
  capability: PartnerCapability,
  certificates: Pick<
    SelectCertifications,
    "uuid" | "capability" | "status" | "expiresOn" | "verifiedAt"
  >[],
  today: string,
): CapabilityStanding => {
  const requiresCertification = REQUIRES_CERTIFICATION[capability];

  if (!requiresCertification) {
    return {
      capability,
      allowed: true,
      requiresCertification: false,
      certificateUuid: null,
      state: null,
      lapsingSoon: false,
      reason: "This capability is a commercial arrangement and needs no certificate.",
    };
  }

  const mine = certificates.filter(
    (certificate) => certificate.capability === capability,
  );
  if (mine.length === 0) {
    return {
      capability,
      allowed: false,
      requiresCertification: true,
      certificateUuid: null,
      state: null,
      lapsingSoon: false,
      reason:
        "No certificate for this capability. The route is: attend a course, pass its assessment, and have the certificate verified.",
    };
  }

  const rank: Record<CertificateStanding, number> = {
    valid: 0,
    unverified: 1,
    expired: 2,
    revoked: 3,
  };

  const best = mine
    .map((certificate) => ({
      certificate,
      state: certificateState(certificate, today),
    }))
    .sort((a, b) => {
      const byStanding = rank[a.state.standing] - rank[b.state.standing];
      if (byStanding !== 0) {
        return byStanding;
      }
      // Among equals, the one that lasts longest. A null expiry never lapses, so
      // it wins outright.
      const aDays = a.state.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
      const bDays = b.state.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
      return bDays - aDays;
    })[0];

  return {
    capability,
    allowed: best.state.standing === "valid",
    requiresCertification: true,
    certificateUuid: best.certificate.uuid,
    state: best.state,
    lapsingSoon: best.state.lapsingSoon,
    reason: best.state.reason,
  };
};

/**
 * Which of the capabilities a partner currently holds they are no longer entitled
 * to.
 *
 * The function that gives expiry teeth. Without it `expiresOn` is decoration — a
 * column nothing reads, which is exactly what `Products.status` was before the
 * supply gate. A capability whose certificate lapsed has to actually stop working,
 * or the certificate was never a requirement at all.
 */
export const lapsedCapabilities = (
  held: PartnerCapability[],
  certificates: Pick<
    SelectCertifications,
    "uuid" | "capability" | "status" | "expiresOn" | "verifiedAt"
  >[],
  today: string,
): CapabilityStanding[] =>
  held
    .map((capability) => capabilityStanding(capability, certificates, today))
    .filter((standing) => !standing.allowed);
