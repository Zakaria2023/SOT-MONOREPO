"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  listServiceRequests,
  recordVisit,
  scheduleCallout,
  type ServiceRequestRow,
} from "services";
import { fail, type ActionResult } from "utils";

export const getServiceRequestsAction = async (): Promise<
  ServiceRequestRow[]
> => {
  await requireAdmin();
  return listServiceRequests();
};

/**
 * Book a date, which is the whole job of this queue.
 *
 * The service guards on `status = 'open'` in the WHERE rather than reading first,
 * so two operators booking the same callout cannot both succeed with the second
 * quietly overwriting the first one's date.
 */
export const scheduleCalloutAction = async (
  requestUuid: string,
  scheduledFor: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await scheduleCallout({ requestUuid, scheduledFor, scheduledBy: actor.name });
    revalidatePath("/service");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to book that visit");
  }
};

/**
 * Record what was done, and say whether it is finished.
 *
 * `close` is a choice rather than automatic. Most visits end the matter; one that
 * had to order a part does not, and a queue that closed it anyway would lose the
 * job somebody still has to come back for.
 */
export const recordVisitAction = async (
  requestUuid: string,
  outcome: string,
  close: boolean,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await recordVisit({ requestUuid, outcome, close });
    revalidatePath("/service");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record that visit");
  }
};
