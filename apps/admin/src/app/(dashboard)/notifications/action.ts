"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { getInbox, markInboxRead, markNotificationRead, type Inbox } from "services";
import { fail, type ActionResult } from "utils";

// The admin desk's inbox. Polled by asking, like the API side — no socket, no
// queue. Admin notices are addressed to the AUDIENCE rather than to a person, so
// everybody on the desk sees the same list and marking one read marks it read
// for the desk.

export const getAdminInboxAction = async (): Promise<Inbox> => {
  const { actor } = await requireAdmin();
  return getInbox("admin", actor.uuid);
};

export const readNotificationAction = async (
  uuid: string,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await markNotificationRead(uuid);
    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to mark that read");
  }
};

export const readAllAction = async (): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await markInboxRead("admin", actor.uuid);
    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to mark those read");
  }
};
