"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getUserOrder, markOrderPaid } from "services";
import { type ActionResult, fail } from "utils";

// Fake payment — no gateway, no API keys, no card ever charged. It simulates the
// round-trip to a provider (a short delay) then settles the order and raises its
// invoice via the already-real markOrderPaid. Swap the delay for a licensed
// provider (SAMA) callback when the real gateway is wired.
export const payOrder = async (
  _prevState: ActionResult,
  orderUuid: string,
): Promise<ActionResult> => {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const owned = await getUserOrder(user.uuid, orderUuid);
  if (!owned) {
    return { error: "Order not found" };
  }

  // Simulate the gateway round-trip so the flow feels like a real charge.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  try {
    await markOrderPaid(orderUuid);
  } catch (error) {
    return fail(error, "Payment failed");
  }

  revalidatePath(`/orders/${orderUuid}`);
  revalidatePath("/orders");
  return {};
};
