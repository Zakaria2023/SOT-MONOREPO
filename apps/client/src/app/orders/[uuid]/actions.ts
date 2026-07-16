"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getUserOrder, markOrderPaid } from "services";

export type PayOrderResult = {
  error?: string;
};

/**
 * Stand-in for the payment gateway callback. A real licensed provider will
 * call the equivalent of markOrderPaid on a successful charge; until then this
 * action settles the order after an ownership check so the flow is walkable.
 */
export const payOrder = async (orderUuid: string): Promise<PayOrderResult> => {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const owned = await getUserOrder(user.uuid, orderUuid);
  if (!owned) return { error: "Order not found" };

  try {
    await markOrderPaid(orderUuid);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Payment failed",
    };
  }

  revalidatePath(`/orders/${orderUuid}`);
  revalidatePath("/orders");
  return {};
};
