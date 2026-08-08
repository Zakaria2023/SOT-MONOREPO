"use server";

import type { PartnerCapability } from "@/db/enum";
import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  captureLead,
  listLeads,
  markLeadConverted,
  markLeadLost,
  offerLead,
  previewRouting,
  qualifyLeadRecord,
  rejectLead,
  type LeadRow,
  type RoutedPartner,
} from "services";
import { fail, type ActionResult } from "utils";

export const getLeadsAction = async (): Promise<LeadRow[]> => {
  await requireAdmin();
  return listLeads();
};

export const captureLeadAction = async (input: {
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  source: string | null;
  enquiry: string | null;
  city: string | null;
}): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await captureLead(input);
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record that lead");
  }
};

/**
 * Fill in the qualification facts.
 *
 * The status only moves to `qualified` when every fact is present — there is no way
 * to wave one through by hand, because the whole value of the gate is that it holds
 * when the queue is long.
 */
export const qualifyLeadAction = async (input: {
  leadUuid: string;
  systems: string[] | null;
  sizeBand: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  contactVerified: boolean;
}): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await qualifyLeadRecord({ ...input, actorName: actor.name });
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to save that");
  }
};

export const rejectLeadAction = async (
  leadUuid: string,
  reason: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await rejectLead(leadUuid, reason);
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to turn that lead down");
  }
};

/** Who it would go to, without offering it to anybody. */
export const previewRoutingAction = async (
  leadUuid: string,
  requiredCapability: PartnerCapability,
): Promise<RoutedPartner[]> => {
  await requireAdmin();
  return previewRouting(leadUuid, requiredCapability);
};

/**
 * Offer it to the next partner in line.
 *
 * The service refuses an unqualified lead — not the screen. A list can be bypassed
 * and a service call cannot.
 */
export const offerLeadAction = async (
  leadUuid: string,
  requiredCapability: PartnerCapability,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await offerLead({ leadUuid, requiredCapability });
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to offer that lead");
  }
};

export const markLeadConvertedAction = async (
  leadUuid: string,
  boqUuid: string | null,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await markLeadConverted({ leadUuid, boqUuid });
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record that conversion");
  }
};

export const markLeadLostAction = async (
  leadUuid: string,
  reason: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await markLeadLost(leadUuid, reason);
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record that");
  }
};
