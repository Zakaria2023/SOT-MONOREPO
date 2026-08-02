"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { requestPayout } from "services";
import { fail, type ActionResult } from "utils";

// Raise a cash-out for all the partner's accrued earnings. A real flow uploads
// the ZATCA invoice first; kept optional here until the upload UI lands.
export const cashOut = async (): Promise<ActionResult> => {
  const user = await requirePartner();

  try {
    await requestPayout({ partnerClerkUserId: user.id });
  } catch (error) {
    return fail(error, "Failed to cash out");
  }

  revalidatePath("/earnings");
  return { success: true };
};
