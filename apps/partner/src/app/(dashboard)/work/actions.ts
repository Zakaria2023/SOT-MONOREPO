"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  buildWorkList,
  getPartnerBoq,
  getPartnerBoqs,
  transitionBoq,
  type PartnerBoqListItem,
  type WorkItem,
} from "services";
import type { BoqStatus } from "@/db/enum";
import { fail, type ActionResult } from "utils";

// P8. Everything dispatched to this partner, ordered by what needs doing.

export const getWorkListAction = async (): Promise<
  WorkItem<PartnerBoqListItem>[]
> => {
  const user = await requirePartner();
  return buildWorkList(await getPartnerBoqs(user.id));
};

/**
 * Move a job on.
 *
 * Ownership checked here and the transition legality checked in the service —
 * two different questions. This one asks "is this job yours"; `transitionBoq`
 * asks "is that move allowed". Neither substitutes for the other, and a partner
 * posting a uuid that was never dispatched to them fails the first.
 */
export const advanceJobAction = async (
  boqUuid: string,
  next: BoqStatus,
): Promise<ActionResult> => {
  const user = await requirePartner();

  const own = await getPartnerBoq(user.id, boqUuid);
  if (!own) {
    return { error: "That job was not dispatched to you." };
  }

  try {
    await transitionBoq(boqUuid, next);
    revalidatePath("/work");
    revalidatePath("/boqs");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to move that job on");
  }
};
