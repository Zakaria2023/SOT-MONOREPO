"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  getSpaceForStaff,
  listAllSpaces,
  verifyFirmware,
  type SpaceDetail,
  type StaffSpaceRow,
} from "services";
import { fail, type ActionResult } from "utils";

export const getSpacesAction = async (): Promise<StaffSpaceRow[]> => {
  await requireAdmin();
  return listAllSpaces();
};

export const getSpaceAction = async (
  spaceUuid: string,
): Promise<SpaceDetail | null> => {
  await requireAdmin();
  return getSpaceForStaff(spaceUuid);
};

/**
 * Confirm a firmware version SOT has actually seen.
 *
 * The ONLY route to `firmwareVerified = true`, and the only reason a firmware rule
 * can ever block rather than warn. There is deliberately no customer path to this:
 * the customer declares what they read, and somebody here checks it.
 *
 * Which makes the actor's name the substance of the record rather than decoration
 * — "verified" with nobody attached is the same as unverified, and worse, because
 * it looks otherwise.
 */
export const verifyFirmwareAction = async (
  itemUuid: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await verifyFirmware(itemUuid, actor.name);
    revalidatePath("/spaces");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to verify that firmware version");
  }
};
