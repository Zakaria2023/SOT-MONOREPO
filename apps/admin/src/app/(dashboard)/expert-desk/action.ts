"use server";

import type { ExpertQueue } from "@/db/enum";
import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  answerExpertRequest,
  claimExpertRequest,
  listQueue,
  openCounts,
  releaseExpertRequest,
  type QueueCounts,
  type SelectExpertRequests,
} from "services";
import { fail, type ActionResult } from "utils";

export const getQueueAction = async (
  queue: ExpertQueue,
): Promise<SelectExpertRequests[]> => {
  await requireAdmin();
  return listQueue(queue);
};

export const getOpenCountsAction = async (): Promise<QueueCounts> => {
  await requireAdmin();
  return openCounts();
};

/** Take a question, so nobody else answers it underneath you. */
export const claimAction = async (uuid: string): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await claimExpertRequest(uuid, actor);
    revalidatePath("/expert-desk");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to take that question");
  }
};

/** Hand it back to the queue rather than leaving it on a desk. */
export const releaseAction = async (uuid: string): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await releaseExpertRequest(uuid);
    revalidatePath("/expert-desk");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to hand that back");
  }
};

export const answerAction = async (
  uuid: string,
  answer: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await answerExpertRequest(uuid, actor, answer);
    revalidatePath("/expert-desk");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to send that answer");
  }
};
