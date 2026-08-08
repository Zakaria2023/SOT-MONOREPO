"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ServiceRequestKind } from "@/db/enum";
import {
  declareFirmware,
  raiseCallout,
  retireSpaceItem,
  setSpaceLocation,
} from "services";
import { fail, type ActionResult } from "utils";

/**
 * The customer tells us what firmware they can see on a device.
 *
 * Thin, like every action here: identity, then one service call. The interesting
 * rule — that this can never mark the version VERIFIED — lives in the service,
 * because a guarantee the rules engine depends on does not belong in a transport.
 */
export const declareFirmwareAction = async (
  itemUuid: string,
  version: string,
): Promise<ActionResult> => {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to update your site." };
  }

  try {
    await declareFirmware({
      userUuid: user.uuid,
      itemUuid,
      version,
      // Named, because an unverified number with no author cannot be chased up.
      declaredBy: user.fullName ?? user.email ?? "the customer",
    });
    revalidatePath("/spaces");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record that firmware version");
  }
};

/**
 * Drop or move the pin for this site.
 *
 * The coordinates come from a click on a map rather than two typed numbers, which
 * is the point of using one: nobody mistypes a decimal place they never typed, and
 * a customer who cannot recite their latitude can still point at their building.
 */
export const setSpaceLocationAction = async (
  spaceUuid: string,
  latitude: number | null,
  longitude: number | null,
): Promise<ActionResult> => {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to update your site." };
  }

  try {
    await setSpaceLocation({
      userUuid: user.uuid,
      spaceUuid,
      latitude,
      longitude,
    });
    revalidatePath("/spaces");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to save that location");
  }
};

/**
 * Ask for somebody to come out.
 *
 * `dueReason` is the sentence the customer was looking at when they pressed the
 * button, passed through rather than recomputed on the server. The clock will have
 * moved by the time anybody reads the request, and "raised because the sensor was
 * three weeks from expiry" has to stay readable in two years when that date is
 * long gone.
 */
export const raiseCalloutAction = async (input: {
  spaceUuid: string;
  itemUuid: string | null;
  kind: ServiceRequestKind;
  detail: string;
  dueReason: string | null;
}): Promise<ActionResult> => {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to ask for a visit." };
  }

  try {
    await raiseCallout({ userUuid: user.uuid, ...input });
    revalidatePath("/spaces");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to ask for a visit");
  }
};

export const retireItemAction = async (
  itemUuid: string,
  reason: string,
): Promise<ActionResult> => {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Sign in to update your site." };
  }

  try {
    await retireSpaceItem({ userUuid: user.uuid, itemUuid, reason });
    revalidatePath("/spaces");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to retire that item");
  }
};
