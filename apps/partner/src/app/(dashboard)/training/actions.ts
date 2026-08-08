"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  listOpenSessions,
  listPartnerCertificates,
  listPartnerRegistrations,
  registerForSession,
  type CertificateRow,
  type RegistrationRow,
  type SessionRow,
} from "services";
import { fail, type ActionResult } from "utils";

export const getOpenSessionsAction = async (): Promise<SessionRow[]> => {
  await requirePartner();
  return listOpenSessions();
};

export const getMyTrainingAction = async (): Promise<{
  registrations: RegistrationRow[];
  certificates: CertificateRow[];
}> => {
  const user = await requirePartner();
  const [registrations, certificates] = await Promise.all([
    listPartnerRegistrations(user.id),
    listPartnerCertificates(user.id),
  ]);
  return { registrations, certificates };
};

/**
 * Take a place on a session.
 *
 * The capacity check and the insert are one transaction in the service, with the
 * count taken inside it — two partners taking the last seat at the same moment would
 * otherwise both read "one place left" and both get it.
 */
export const registerAction = async (
  sessionUuid: string,
): Promise<ActionResult> => {
  const user = await requirePartner();
  try {
    await registerForSession({
      sessionUuid,
      partnerClerkUserId: user.id,
      // Denormalised onto the registration, so the mark-up sheet still reads after
      // somebody leaves the company and their Clerk account goes.
      partnerName:
        user.fullName ??
        user.emailAddresses[0]?.emailAddress ??
        "A partner",
    });
    revalidatePath("/training");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to register");
  }
};
