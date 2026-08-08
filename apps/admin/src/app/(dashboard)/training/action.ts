"use server";

import type { PartnerCapability, TrainingDeliveryMode } from "@/db/enum";
import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  createCourse,
  createSession,
  findLapsedCapabilities,
  issueCertificate,
  listCertificates,
  listCourses,
  listRegistrations,
  listSessions,
  markAttendance,
  recordAssessment,
  recordExternalCertificate,
  revokeCertificate,
  verifyCertificate,
  type CapabilityStanding,
  type CertificateRow,
  type CourseRow,
  type RegistrationRow,
  type SessionRow,
} from "services";
import { fail, type ActionResult } from "utils";

export const getCoursesAction = async (): Promise<CourseRow[]> => {
  await requireAdmin();
  return listCourses();
};

export const getSessionsAction = async (): Promise<SessionRow[]> => {
  await requireAdmin();
  return listSessions();
};

export const getRegistrationsAction = async (
  sessionUuid: string,
): Promise<RegistrationRow[]> => {
  await requireAdmin();
  return listRegistrations(sessionUuid);
};

export const getCertificatesAction = async (): Promise<CertificateRow[]> => {
  await requireAdmin();
  return listCertificates();
};

export const createCourseAction = async (input: {
  title: string;
  summary: string | null;
  system: string | null;
  unlocksCapability: PartnerCapability | null;
  validForMonths: number | null;
  hasAssessment: boolean;
  passMark: number;
}): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await createCourse(input);
    revalidatePath("/training");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to create that course");
  }
};

export const createSessionAction = async (input: {
  courseUuid: string;
  mode: TrainingDeliveryMode;
  heldOn: string | null;
  timing: string | null;
  location: string | null;
  capacity: number | null;
  trainerName: string | null;
}): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await createSession(input);
    revalidatePath("/training");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to schedule that session");
  }
};

export const markAttendanceAction = async (
  registrationUuid: string,
  attended: boolean,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await markAttendance(registrationUuid, attended);
    revalidatePath("/training");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record attendance");
  }
};

/**
 * Record the mark.
 *
 * Does NOT issue the certificate — that is `issueCertificateAction`, deliberately
 * separate. Passing an assessment and holding a verified certificate are different
 * facts, and collapsing them would make `verifiedAt` meaningless for the
 * certificates SOT issues itself, which are most of them.
 */
export const recordAssessmentAction = async (
  registrationUuid: string,
  score: number,
  notes: string | null,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await recordAssessment({
      registrationUuid,
      score,
      assessedBy: actor.name,
      notes,
    });
    revalidatePath("/training");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record that assessment");
  }
};

/**
 * Issue a certificate for a pass.
 *
 * The gate runs in the service and reads the SCORE, never attendance. It cannot be
 * talked round from here, which is the point of it living there.
 */
export const issueCertificateAction = async (
  registrationUuid: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await issueCertificate({ registrationUuid, issuedBy: actor.name });
    revalidatePath("/training");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to issue that certificate");
  }
};

/**
 * Confirm a certificate SOT has actually seen.
 *
 * The only route to `verifiedAt`, and therefore the only route to a capability that
 * requires one. Which makes the actor's name the substance of the record: verified
 * by nobody is the same as unverified, and worse, because it looks otherwise.
 */
export const verifyCertificateAction = async (
  certificateUuid: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await verifyCertificate(certificateUuid, actor.name);
    revalidatePath("/training");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to verify that certificate");
  }
};

export const revokeCertificateAction = async (
  certificateUuid: string,
  reason: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await revokeCertificate(certificateUuid, reason);
    revalidatePath("/training");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to withdraw that certificate");
  }
};

/**
 * Record a certificate a partner holds from elsewhere.
 *
 * The escape hatch that means `grantCapability` needs no override. A partner
 * certified directly by a vendor has real competence and no SOT registration; the
 * honest way through is to put their evidence on file and verify it, not to add a
 * flag that skips the check and leaves nothing to look at.
 */
export const recordExternalCertificateAction = async (input: {
  partnerClerkUserId: string;
  partnerName: string;
  capability: PartnerCapability;
  issuedByName: string;
  externalReference: string | null;
  issuedOn: string;
  expiresOn: string | null;
}): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await recordExternalCertificate(input);
    revalidatePath("/training");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record that certificate");
  }
};

/**
 * Which partners are holding a capability whose certificate has gone.
 *
 * Reports rather than revokes. Taking a capability away narrows what a partner may
 * sell and cuts their discount in the same moment, and doing that from a background
 * pass with nobody's name on it is how somebody discovers their pricing changed and
 * cannot find out why. A human revokes it, from the partner screen, with a reason.
 *
 * Safety does not depend on this being run: `grantCapability` refuses without a
 * valid certificate, and every standing shown anywhere is derived from the date.
 */
export const getLapsedCapabilitiesAction = async (): Promise<
  { partnerUuid: string; partnerName: string | null; lapsed: CapabilityStanding[] }[]
> => {
  await requireAdmin();
  return findLapsedCapabilities();
};
