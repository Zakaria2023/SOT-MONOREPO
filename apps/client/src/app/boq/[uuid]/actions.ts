"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  confirmHandoverByCustomer,
  createOrderFromSelectedOffer,
  disputeHandover,
  getCustomerHandover,
  selectOffer,
} from "services";

export type SelectOfferResult = {
  error?: string;
};

export const chooseOffer = async (
  boqUuid: string,
  offerUuid: string,
): Promise<SelectOfferResult> => {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await selectOffer({ userUuid: user.uuid, boqUuid, offerUuid });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to select offer",
    };
  }

  revalidatePath(`/boq/${boqUuid}`);
  revalidatePath("/offers");
  return {};
};

// Confirm-then-pay: turn the selected offer into an order, then send the
// customer to the order's payment page. Redirect happens on the server.
export const confirmOrder = async (
  boqUuid: string,
): Promise<SelectOfferResult> => {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  let orderUuid: string;
  try {
    const order = await createOrderFromSelectedOffer({
      userUuid: user.uuid,
      boqUuid,
    });
    orderUuid = order.uuid;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to confirm order",
    };
  }

  redirect(`/orders/${orderUuid}`);
};

// The customer's own verification — confirms their access works.
export const confirmHandover = async (
  boqUuid: string,
): Promise<SelectOfferResult> => {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await confirmHandoverByCustomer({ userUuid: user.uuid, boqUuid });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to confirm handover",
    };
  }

  revalidatePath(`/boq/${boqUuid}/handover`);
  return {};
};

export const reportHandoverIssue = async (
  boqUuid: string,
  reason: string,
): Promise<SelectOfferResult> => {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!reason.trim()) return { error: "Describe the issue first" };

  // Ownership guard — the service dispute call isn't customer-scoped.
  const owned = await getCustomerHandover(user.uuid, boqUuid);
  if (!owned) return { error: "Handover not found" };

  try {
    await disputeHandover({ boqUuid, reason });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to report issue",
    };
  }

  revalidatePath(`/boq/${boqUuid}/handover`);
  return {};
};
