"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { requestPayout } from "services";

export type CashOutState = {
  error?: string;
  success?: boolean;
};

// Raise a cash-out for all the partner's accrued earnings. A real flow uploads
// the ZATCA invoice first; kept optional here until the upload UI lands.
export const cashOut = async (): Promise<CashOutState> => {
  const user = await requirePartner();

  try {
    await requestPayout({ partnerClerkUserId: user.id });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to cash out",
    };
  }

  revalidatePath("/earnings");
  return { success: true };
};
