import { and, asc, desc, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type { PartnerCapability } from "../../../db/enum";
import { Brands, type SelectBrands } from "../../../db/schema/brands";
import { PartnerRequests } from "../../../db/schema/partner-requests";
import {
  Certifications,
  TrainingCourses,
  TrainingRegistrations,
  TrainingSessions,
  type SelectCertifications,
  type SelectTrainingCourses,
  type SelectTrainingRegistrations,
  type SelectTrainingSessions,
} from "../../../db/schema/training";
import { addMonths, parseDate } from "./service-schedule";
import {
  canCertify,
  capabilityStanding,
  certificateState,
  lapsedCapabilities,
  REQUIRES_CERTIFICATION,
  type CapabilityStanding,
  type CertificateState,
} from "./certification-gate";
import { ConflictError, ValidationError } from "./errors";
import { notify } from "./notifications";

export type {
  SelectCertifications,
  SelectTrainingCourses,
  SelectTrainingRegistrations,
  SelectTrainingSessions,
};

// ---------------------------------------------------------------------------
// 7.1 / 7.2 — TRAINING, ASSESSMENT, CERTIFICATION.
//
// The supply side of the capability model, and the answer to what was the largest
// open item in the partner module. `certification-gate.ts` holds the two rules;
// this holds the reads and writes.
//
// The one thing worth reading carefully is `recordAssessment` → `issueCertificate`.
// They are separate calls on purpose: passing an assessment and holding a verified
// certificate are different facts, and SOT verifying its own course's certificate
// is a real step somebody performs rather than a formality to skip. Collapsing them
// would make `verifiedAt` meaningless for exactly the certificates we issue
// ourselves, which are most of them.
// ---------------------------------------------------------------------------

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export type CourseRow = SelectTrainingCourses & {
  brandName: SelectBrands["name"] | null;
  // Aggregates — no single column backs them.
  sessionCount: number;
  upcomingCount: number;
};

export type SessionRow = SelectTrainingSessions & {
  courseTitle: SelectTrainingCourses["title"];
  unlocksCapability: SelectTrainingCourses["unlocksCapability"];
  passMark: SelectTrainingCourses["passMark"];
  hasAssessment: SelectTrainingCourses["hasAssessment"];
  brandName: SelectBrands["name"] | null;
  registeredCount: number;
  // Null capacity means uncapped, so this is null too rather than 0 — "no places
  // left" and "no limit" must not render the same.
  placesLeft: number | null;
};

export type RegistrationRow = SelectTrainingRegistrations & {
  courseTitle: SelectTrainingCourses["title"];
  unlocksCapability: SelectTrainingCourses["unlocksCapability"];
  passMark: SelectTrainingCourses["passMark"];
  hasAssessment: SelectTrainingCourses["hasAssessment"];
  heldOn: SelectTrainingSessions["heldOn"];
  mode: SelectTrainingSessions["mode"];
  // Whether this registration has already produced a certificate. Carried so a
  // screen never offers to certify the same pass twice.
  certificateUuid: SelectCertifications["uuid"] | null;
};

// ---------------------------------------------------------------------------
// Courses and sessions.
// ---------------------------------------------------------------------------

export type CourseInput = {
  title: string;
  summary?: string | null;
  brandUuid?: string | null;
  system?: string | null;
  unlocksCapability?: PartnerCapability | null;
  validForMonths?: number | null;
  hasAssessment: boolean;
  passMark: number;
};

export const createCourse = async (
  input: CourseInput,
): Promise<SelectTrainingCourses> => {
  const title = input.title.trim();
  if (title === "") {
    throw new ValidationError("A course needs a title.");
  }
  if (input.passMark < 1 || input.passMark > 100) {
    throw new ValidationError("The pass mark has to be between 1 and 100.");
  }

  // A course that grants a capability and has no assessment cannot ever issue a
  // certificate, so it would be a course whose whole reason for existing is
  // unreachable. Caught here rather than discovered by a partner who attended it.
  if (input.unlocksCapability && !input.hasAssessment) {
    throw new ValidationError(
      "A course that unlocks a capability needs an assessment — a capability cannot be granted on attendance alone.",
    );
  }

  const uuid = generateUuid();
  await db.insert(TrainingCourses).values({
    uuid,
    title,
    summary: input.summary?.trim() || null,
    brandUuid: input.brandUuid ?? null,
    system: input.system?.trim() || null,
    unlocksCapability: input.unlocksCapability ?? null,
    validForMonths: input.validForMonths ?? null,
    hasAssessment: input.hasAssessment ? 1 : 0,
    passMark: input.passMark,
  });

  const [course] = await db
    .select()
    .from(TrainingCourses)
    .where(eq(TrainingCourses.uuid, uuid));
  if (!course) {
    throw new Error("Failed to create that course");
  }
  return course;
};

/**
 * Every course, with how many sessions it has and how many are still to come.
 *
 * Identifiers written out and table-qualified rather than interpolated. Drizzle only
 * qualifies a column when the query has a join, so `${TrainingCourses.uuid}` renders
 * bare the moment somebody drops the `leftJoin` below — and a bare `uuid` inside the
 * sub-query resolves to `TrainingSessions.uuid`, correlating a table against itself
 * and returning 0 forever. That failure has no error and no visible symptom.
 */
export const listCourses = async (): Promise<CourseRow[]> =>
  db
    .select({
      ...getTableColumns(TrainingCourses),
      brandName: Brands.name,
      sessionCount: sql<number>`(
        SELECT COUNT(*) FROM \`TrainingSessions\`
        WHERE \`TrainingSessions\`.\`course_uuid\` = \`TrainingCourses\`.\`uuid\`
      )`.mapWith(Number),
      upcomingCount: sql<number>`(
        SELECT COUNT(*) FROM \`TrainingSessions\`
        WHERE \`TrainingSessions\`.\`course_uuid\` = \`TrainingCourses\`.\`uuid\`
          AND \`TrainingSessions\`.\`cancelled_at\` IS NULL
          AND (\`TrainingSessions\`.\`held_on\` IS NULL OR \`TrainingSessions\`.\`held_on\` >= CURDATE())
      )`.mapWith(Number),
    })
    .from(TrainingCourses)
    .leftJoin(Brands, eq(TrainingCourses.brandUuid, Brands.uuid))
    .orderBy(desc(TrainingCourses.active), asc(TrainingCourses.title));

export type SessionInput = {
  courseUuid: string;
  mode: SelectTrainingSessions["mode"];
  heldOn?: string | null;
  timing?: string | null;
  location?: string | null;
  capacity?: number | null;
  trainerName?: string | null;
  notes?: string | null;
};

export const createSession = async (
  input: SessionInput,
): Promise<SelectTrainingSessions> => {
  const [course] = await db
    .select({ uuid: TrainingCourses.uuid })
    .from(TrainingCourses)
    .where(eq(TrainingCourses.uuid, input.courseUuid));
  if (!course) {
    throw new ValidationError("That course no longer exists.");
  }

  // A dated session needs a readable date. `self_paced` genuinely has none, which
  // is why the check is conditional rather than universal.
  if (input.mode !== "self_paced") {
    if (!input.heldOn || parseDate(input.heldOn) === null) {
      throw new ValidationError("Give the session a date.");
    }
  }
  if (input.capacity !== null && input.capacity !== undefined && input.capacity < 1) {
    throw new ValidationError("Capacity has to be at least 1, or left blank for no limit.");
  }

  const uuid = generateUuid();
  await db.insert(TrainingSessions).values({
    uuid,
    courseUuid: input.courseUuid,
    mode: input.mode,
    heldOn: input.mode === "self_paced" ? null : (input.heldOn ?? null),
    timing: input.timing?.trim() || null,
    location: input.location?.trim() || null,
    capacity: input.capacity ?? null,
    trainerName: input.trainerName?.trim() || null,
    notes: input.notes?.trim() || null,
  });

  const [session] = await db
    .select()
    .from(TrainingSessions)
    .where(eq(TrainingSessions.uuid, uuid));
  if (!session) {
    throw new Error("Failed to create that session");
  }
  return session;
};

const sessionSelection = {
  ...getTableColumns(TrainingSessions),
  courseTitle: TrainingCourses.title,
  unlocksCapability: TrainingCourses.unlocksCapability,
  passMark: TrainingCourses.passMark,
  hasAssessment: TrainingCourses.hasAssessment,
  brandName: Brands.name,
  registeredCount: sql<number>`(
    SELECT COUNT(*) FROM \`TrainingRegistrations\`
    WHERE \`TrainingRegistrations\`.\`session_uuid\` = \`TrainingSessions\`.\`uuid\`
      AND \`TrainingRegistrations\`.\`status\` <> 'cancelled'
  )`.mapWith(Number),
};

const withPlacesLeft = (row: Omit<SessionRow, "placesLeft">): SessionRow => ({
  ...row,
  // Null capacity means uncapped. Returning 0 would make a webinar with no limit
  // render identically to a full room.
  placesLeft:
    row.capacity === null
      ? null
      : Math.max(0, row.capacity - row.registeredCount),
});

/** Every session, newest date first. */
export const listSessions = async (): Promise<SessionRow[]> => {
  const rows = await db
    .select(sessionSelection)
    .from(TrainingSessions)
    .innerJoin(TrainingCourses, eq(TrainingSessions.courseUuid, TrainingCourses.uuid))
    .leftJoin(Brands, eq(TrainingCourses.brandUuid, Brands.uuid))
    .orderBy(desc(TrainingSessions.heldOn));
  return rows.map(withPlacesLeft);
};

/**
 * What a partner can still sign up for.
 *
 * Cancelled sessions and past dates are excluded here rather than filtered on the
 * screen — an offer a partner cannot take is worse than no offer, and a list that
 * shows last month's course invites them to try.
 */
export const listOpenSessions = async (): Promise<SessionRow[]> => {
  const rows = await db
    .select(sessionSelection)
    .from(TrainingSessions)
    .innerJoin(TrainingCourses, eq(TrainingSessions.courseUuid, TrainingCourses.uuid))
    .leftJoin(Brands, eq(TrainingCourses.brandUuid, Brands.uuid))
    .where(
      and(
        isNull(TrainingSessions.cancelledAt),
        eq(TrainingCourses.active, 1),
        sql`(${TrainingSessions.heldOn} IS NULL OR ${TrainingSessions.heldOn} >= CURDATE())`,
      ),
    )
    .orderBy(asc(TrainingSessions.heldOn));
  return rows.map(withPlacesLeft);
};

// ---------------------------------------------------------------------------
// Registering and attending.
// ---------------------------------------------------------------------------

/**
 * A partner signs up.
 *
 * The capacity check and the insert are in one transaction with the count taken
 * inside it. Two partners taking the last seat at the same moment would otherwise
 * both read "one place left" and both get it.
 */
export const registerForSession = async ({
  sessionUuid,
  partnerClerkUserId,
  partnerName,
}: {
  sessionUuid: string;
  partnerClerkUserId: string;
  partnerName: string;
}): Promise<SelectTrainingRegistrations> => {
  const uuid = generateUuid();

  await db.transaction(async (tx) => {
    const [session] = await tx
      .select({
        uuid: TrainingSessions.uuid,
        capacity: TrainingSessions.capacity,
        cancelledAt: TrainingSessions.cancelledAt,
      })
      .from(TrainingSessions)
      .where(eq(TrainingSessions.uuid, sessionUuid))
      .for("update");
    if (!session) {
      throw new ValidationError("That session no longer exists.");
    }
    if (session.cancelledAt !== null) {
      throw new ConflictError("That session has been cancelled.");
    }

    const [existing] = await tx
      .select({ uuid: TrainingRegistrations.uuid })
      .from(TrainingRegistrations)
      .where(
        and(
          eq(TrainingRegistrations.sessionUuid, sessionUuid),
          eq(TrainingRegistrations.partnerClerkUserId, partnerClerkUserId),
        ),
      );
    if (existing) {
      throw new ConflictError("You are already registered for this session.");
    }

    if (session.capacity !== null) {
      const [count] = await tx
        .select({ total: sql<number>`COUNT(*)`.mapWith(Number) })
        .from(TrainingRegistrations)
        .where(
          and(
            eq(TrainingRegistrations.sessionUuid, sessionUuid),
            sql`${TrainingRegistrations.status} <> 'cancelled'`,
          ),
        );
      if ((count?.total ?? 0) >= session.capacity) {
        throw new ConflictError("This session is full.");
      }
    }

    await tx.insert(TrainingRegistrations).values({
      uuid,
      sessionUuid,
      partnerClerkUserId,
      partnerName,
    });
  });

  const [registration] = await db
    .select()
    .from(TrainingRegistrations)
    .where(eq(TrainingRegistrations.uuid, uuid));
  if (!registration) {
    throw new Error("Failed to register");
  }
  return registration;
};

/** Mark who turned up. */
export const markAttendance = async (
  registrationUuid: string,
  attended: boolean,
): Promise<void> => {
  await db
    .update(TrainingRegistrations)
    .set({
      status: attended ? "attended" : "no_show",
      attendedAt: attended ? new Date() : null,
    })
    .where(eq(TrainingRegistrations.uuid, registrationUuid));
};

const registrationSelection = {
  ...getTableColumns(TrainingRegistrations),
  courseTitle: TrainingCourses.title,
  unlocksCapability: TrainingCourses.unlocksCapability,
  passMark: TrainingCourses.passMark,
  hasAssessment: TrainingCourses.hasAssessment,
  heldOn: TrainingSessions.heldOn,
  mode: TrainingSessions.mode,
  certificateUuid: Certifications.uuid,
};

/** Everyone on one session, for the trainer marking it up. */
export const listRegistrations = async (
  sessionUuid: string,
): Promise<RegistrationRow[]> =>
  db
    .select(registrationSelection)
    .from(TrainingRegistrations)
    .innerJoin(TrainingSessions, eq(TrainingRegistrations.sessionUuid, TrainingSessions.uuid))
    .innerJoin(TrainingCourses, eq(TrainingSessions.courseUuid, TrainingCourses.uuid))
    .leftJoin(
      Certifications,
      eq(Certifications.registrationUuid, TrainingRegistrations.uuid),
    )
    .where(eq(TrainingRegistrations.sessionUuid, sessionUuid))
    .orderBy(asc(TrainingRegistrations.partnerName));

/** One partner's own training history. */
export const listPartnerRegistrations = async (
  partnerClerkUserId: string,
): Promise<RegistrationRow[]> =>
  db
    .select(registrationSelection)
    .from(TrainingRegistrations)
    .innerJoin(TrainingSessions, eq(TrainingRegistrations.sessionUuid, TrainingSessions.uuid))
    .innerJoin(TrainingCourses, eq(TrainingSessions.courseUuid, TrainingCourses.uuid))
    .leftJoin(
      Certifications,
      eq(Certifications.registrationUuid, TrainingRegistrations.uuid),
    )
    .where(eq(TrainingRegistrations.partnerClerkUserId, partnerClerkUserId))
    .orderBy(desc(TrainingRegistrations.createdAt));

/**
 * Record the assessment.
 *
 * Sets `passed` or `failed` from the mark, and does NOT issue the certificate.
 * That is a second, deliberate step — see the file header.
 */
export const recordAssessment = async ({
  registrationUuid,
  score,
  assessedBy,
  notes,
}: {
  registrationUuid: string;
  score: number;
  assessedBy: string;
  notes?: string | null;
}): Promise<RegistrationRow> => {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new ValidationError("A score is a whole percentage from 0 to 100.");
  }

  const [row] = await db
    .select({
      passMark: TrainingCourses.passMark,
      hasAssessment: TrainingCourses.hasAssessment,
      status: TrainingRegistrations.status,
    })
    .from(TrainingRegistrations)
    .innerJoin(TrainingSessions, eq(TrainingRegistrations.sessionUuid, TrainingSessions.uuid))
    .innerJoin(TrainingCourses, eq(TrainingSessions.courseUuid, TrainingCourses.uuid))
    .where(eq(TrainingRegistrations.uuid, registrationUuid));
  if (!row) {
    throw new ValidationError("That registration no longer exists.");
  }
  if (!row.hasAssessment) {
    throw new ConflictError("This course has no assessment.");
  }
  if (row.status === "cancelled") {
    throw new ConflictError("That registration was cancelled.");
  }

  await db
    .update(TrainingRegistrations)
    .set({
      status: score >= row.passMark ? "passed" : "failed",
      assessmentScore: score,
      assessedAt: new Date(),
      assessedBy,
      assessmentNotes: notes?.trim() || null,
    })
    .where(eq(TrainingRegistrations.uuid, registrationUuid));

  const [updated] = await db
    .select(registrationSelection)
    .from(TrainingRegistrations)
    .innerJoin(TrainingSessions, eq(TrainingRegistrations.sessionUuid, TrainingSessions.uuid))
    .innerJoin(TrainingCourses, eq(TrainingSessions.courseUuid, TrainingCourses.uuid))
    .leftJoin(
      Certifications,
      eq(Certifications.registrationUuid, TrainingRegistrations.uuid),
    )
    .where(eq(TrainingRegistrations.uuid, registrationUuid));
  if (!updated) {
    throw new Error("Failed to record that assessment");
  }

  await notify({
    audience: "client",
    kind: "certification",
    recipientClerkUserId: updated.partnerClerkUserId,
    title:
      updated.status === "passed"
        ? `You passed ${updated.courseTitle}`
        : `Your ${updated.courseTitle} assessment result`,
    body:
      updated.status === "passed"
        ? `Scored ${score}%. Your certificate follows once we have issued it.`
        : `Scored ${score}%, and the pass mark is ${row.passMark}%. You can sit it again on a later session.`,
    href: "/training",
  });

  return updated;
};

// ---------------------------------------------------------------------------
// Certificates.
// ---------------------------------------------------------------------------

/**
 * Issue a certificate for a passed assessment.
 *
 * Runs `canCertify` — the gate that reads the SCORE and never attendance — then
 * dates the expiry from the course's `validForMonths`. Issued
 * `pending_verification`: even our own certificate is checked by a person, because
 * otherwise `verifiedAt` would be meaningless for the majority of certificates and
 * the second gate would only ever bite on external ones.
 */
export const issueCertificate = async ({
  registrationUuid,
  issuedBy,
}: {
  registrationUuid: string;
  issuedBy: string;
}): Promise<SelectCertifications> => {
  const [row] = await db
    .select({
      registration: getTableColumns(TrainingRegistrations),
      passMark: TrainingCourses.passMark,
      hasAssessment: TrainingCourses.hasAssessment,
      unlocksCapability: TrainingCourses.unlocksCapability,
      validForMonths: TrainingCourses.validForMonths,
      courseTitle: TrainingCourses.title,
    })
    .from(TrainingRegistrations)
    .innerJoin(TrainingSessions, eq(TrainingRegistrations.sessionUuid, TrainingSessions.uuid))
    .innerJoin(TrainingCourses, eq(TrainingSessions.courseUuid, TrainingCourses.uuid))
    .where(eq(TrainingRegistrations.uuid, registrationUuid));
  if (!row) {
    throw new ValidationError("That registration no longer exists.");
  }

  const check = canCertify({
    status: row.registration.status,
    assessmentScore: row.registration.assessmentScore,
    passMark: row.passMark,
    hasAssessment: row.hasAssessment === 1,
    unlocksCapability: row.unlocksCapability,
  });
  if (!check.allowed) {
    throw new ValidationError(check.reason);
  }
  if (row.unlocksCapability === null) {
    // Unreachable while canCertify refuses a null capability, and asserted here so
    // the narrowing is real rather than assumed.
    throw new ValidationError("This course grants no capability.");
  }

  const [existing] = await db
    .select({ uuid: Certifications.uuid })
    .from(Certifications)
    .where(eq(Certifications.registrationUuid, registrationUuid));
  if (existing) {
    throw new ConflictError(
      "A certificate has already been issued for this assessment.",
    );
  }

  const issuedOn = todayIso();
  const parsed = parseDate(issuedOn);
  if (!parsed) {
    throw new Error("Could not read today's date.");
  }

  const uuid = generateUuid();
  await db.insert(Certifications).values({
    uuid,
    reference: `CERT-${uuid.slice(0, 8).toUpperCase()}`,
    partnerClerkUserId: row.registration.partnerClerkUserId,
    partnerName: row.registration.partnerName,
    capability: row.unlocksCapability,
    registrationUuid,
    issuedByName: "SOT",
    issuedOn,
    // Null validForMonths means it does not expire — a real case for foundational
    // training, and carried through as a null rather than a far-future date.
    expiresOn:
      row.validForMonths === null
        ? null
        : (() => {
            const end = addMonths(parsed, row.validForMonths);
            return `${end.year}-${String(end.month).padStart(2, "0")}-${String(end.day).padStart(2, "0")}`;
          })(),
  });

  const [certificate] = await db
    .select()
    .from(Certifications)
    .where(eq(Certifications.uuid, uuid));
  if (!certificate) {
    throw new Error("Failed to issue that certificate");
  }

  await notify({
    audience: "admin",
    kind: "certification",
    title: `${certificate.reference} needs verifying`,
    body: `${row.registration.partnerName ?? "A partner"} passed ${row.courseTitle}. The certificate unlocks ${row.unlocksCapability} once verified.`,
    href: "/training/certifications",
  });

  void issuedBy;
  return certificate;
};

export type ExternalCertificateInput = {
  partnerClerkUserId: string;
  partnerName: string;
  capability: PartnerCapability;
  issuedByName: string;
  externalReference?: string | null;
  documentId?: string | null;
  issuedOn: string;
  expiresOn?: string | null;
};

/**
 * Record a certificate a partner holds from somewhere else.
 *
 * THE ESCAPE HATCH, and the reason `grantCapability` needs no override. A partner
 * certified directly by a vendor has real competence and no SOT registration, and
 * the honest way to let them through is to put their evidence on file and verify
 * it — not to add a flag that skips the check and leaves nothing to look at.
 */
export const recordExternalCertificate = async (
  input: ExternalCertificateInput,
): Promise<SelectCertifications> => {
  if (input.issuedByName.trim() === "") {
    throw new ValidationError("Say who issued it.");
  }
  if (parseDate(input.issuedOn) === null) {
    throw new ValidationError("Give the date it was issued.");
  }
  if (input.expiresOn && parseDate(input.expiresOn) === null) {
    throw new ValidationError("That expiry date could not be read.");
  }

  const uuid = generateUuid();
  await db.insert(Certifications).values({
    uuid,
    reference: `CERT-${uuid.slice(0, 8).toUpperCase()}`,
    partnerClerkUserId: input.partnerClerkUserId,
    partnerName: input.partnerName,
    capability: input.capability,
    issuedByName: input.issuedByName.trim(),
    externalReference: input.externalReference?.trim() || null,
    documentId: input.documentId ?? null,
    issuedOn: input.issuedOn,
    expiresOn: input.expiresOn ?? null,
  });

  const [certificate] = await db
    .select()
    .from(Certifications)
    .where(eq(Certifications.uuid, uuid));
  if (!certificate) {
    throw new Error("Failed to record that certificate");
  }
  return certificate;
};

/**
 * SOT confirms a certificate it has actually seen.
 *
 * The only route to `verifiedAt`, and therefore the only route to a capability that
 * requires one. Guarded in the WHERE on `pending_verification`, so verifying a
 * revoked certificate cannot quietly bring it back.
 */
export const verifyCertificate = async (
  certificateUuid: string,
  verifiedBy: string,
): Promise<SelectCertifications> => {
  const result = await db
    .update(Certifications)
    .set({ status: "verified", verifiedAt: new Date(), verifiedBy })
    .where(
      and(
        eq(Certifications.uuid, certificateUuid),
        eq(Certifications.status, "pending_verification"),
      ),
    );

  const affected = (result as unknown as { affectedRows?: number }[])[0]
    ?.affectedRows;
  if (affected === 0) {
    throw new ConflictError(
      "That certificate is not awaiting verification — it may already be verified, expired or revoked.",
    );
  }

  const [certificate] = await db
    .select()
    .from(Certifications)
    .where(eq(Certifications.uuid, certificateUuid));
  if (!certificate) {
    throw new Error("Failed to verify that certificate");
  }

  await notify({
    audience: "client",
    kind: "certification",
    recipientClerkUserId: certificate.partnerClerkUserId,
    title: `${certificate.reference} verified`,
    body: `Your ${certificate.capability} certification is now recognised${
      certificate.expiresOn ? ` until ${certificate.expiresOn}` : ""
    }.`,
    href: "/training",
  });

  return certificate;
};

export const revokeCertificate = async (
  certificateUuid: string,
  reason: string,
): Promise<void> => {
  if (reason.trim() === "") {
    throw new ValidationError("Revoking a certificate needs a reason.");
  }
  await db
    .update(Certifications)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokedReason: reason.trim(),
    })
    .where(eq(Certifications.uuid, certificateUuid));
};

export type CertificateRow = SelectCertifications & {
  state: CertificateState;
};

/** Every certificate, with its standing computed from today's date. */
export const listCertificates = async (): Promise<CertificateRow[]> => {
  const today = todayIso();
  const rows = await db
    .select()
    .from(Certifications)
    .orderBy(desc(Certifications.createdAt));
  return rows.map((row) => ({ ...row, state: certificateState(row, today) }));
};

/** One partner's certificates. */
export const listPartnerCertificates = async (
  partnerClerkUserId: string,
): Promise<CertificateRow[]> => {
  const today = todayIso();
  const rows = await db
    .select()
    .from(Certifications)
    .where(eq(Certifications.partnerClerkUserId, partnerClerkUserId))
    .orderBy(desc(Certifications.issuedOn));
  return rows.map((row) => ({ ...row, state: certificateState(row, today) }));
};

/**
 * What a partner may currently do, and why — for every capability.
 *
 * The partner's own badge screen reads this. It answers "why can I not do X" with
 * the route rather than a locked icon, which is the difference between a screen
 * that sells training and one that just refuses.
 */
export const getCapabilityStandings = async (
  partnerClerkUserId: string,
  held: PartnerCapability[],
): Promise<CapabilityStanding[]> => {
  const today = todayIso();
  const certificates = await db
    .select({
      uuid: Certifications.uuid,
      capability: Certifications.capability,
      status: Certifications.status,
      expiresOn: Certifications.expiresOn,
      verifiedAt: Certifications.verifiedAt,
    })
    .from(Certifications)
    .where(eq(Certifications.partnerClerkUserId, partnerClerkUserId));

  return (Object.keys(REQUIRES_CERTIFICATION) as PartnerCapability[]).map(
    (capability) => {
      const standing = capabilityStanding(capability, certificates, today);
      return {
        ...standing,
        // A capability they do not hold is not "allowed" in any useful sense, but
        // the standing still explains what it would take — which is the whole point
        // of showing it.
        allowed: standing.allowed && held.includes(capability),
      };
    },
  );
};

/**
 * Which held capabilities have lost their certificate.
 *
 * The sweep that gives expiry teeth. Returns rather than revokes: taking a
 * capability away narrows what a partner may sell and cuts their discount in the
 * same moment, and doing that from a background pass with nobody's name on it is
 * how a partner discovers their pricing changed and cannot find out why.
 *
 * There is no scheduler in this system, so this is invoked from the admin screen.
 * Said plainly rather than implied: the gate on `grantCapability` and the derived
 * standing everywhere else mean a lapsed certificate never grants anything, so this
 * sweep is for tidying the record and telling people — not for safety.
 */
export const findLapsedCapabilities = async (): Promise<
  { partnerUuid: string; partnerName: string | null; lapsed: CapabilityStanding[] }[]
> => {
  const today = todayIso();

  const partners = await db
    .select({
      uuid: PartnerRequests.uuid,
      name: PartnerRequests.companyName,
      clerkUserId: PartnerRequests.approvedClerkUserId,
      capabilities: PartnerRequests.capabilities,
    })
    .from(PartnerRequests)
    .where(eq(PartnerRequests.status, "approved"));

  const clerkIds = partners
    .map((partner) => partner.clerkUserId)
    .filter((id): id is string => id !== null);
  if (clerkIds.length === 0) {
    return [];
  }

  // One read for every partner's certificates, not one per partner. The pool is
  // shared across five apps.
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

  const byPartner = new Map<string, typeof certificates>();
  for (const certificate of certificates) {
    const list = byPartner.get(certificate.partnerClerkUserId) ?? [];
    list.push(certificate);
    byPartner.set(certificate.partnerClerkUserId, list);
  }

  return partners.flatMap((partner) => {
    if (partner.clerkUserId === null) {
      return [];
    }
    const lapsed = lapsedCapabilities(
      (partner.capabilities ?? []) as PartnerCapability[],
      byPartner.get(partner.clerkUserId) ?? [],
      today,
    );
    return lapsed.length === 0
      ? []
      : [{ partnerUuid: partner.uuid, partnerName: partner.name, lapsed }];
  });
};
