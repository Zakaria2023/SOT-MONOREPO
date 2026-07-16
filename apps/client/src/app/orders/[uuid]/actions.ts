"use server";

export type PayOrderResult = {
  error?: string;
};

// Payment is disabled for now — there is no gateway yet. Kept as a dormant stub
// so the UI import stays valid and the flow can be restored quickly. The real
// implementation (markOrderPaid + ownership check) is commented out below.
export const payOrder = async (
  _orderUuid: string,
): Promise<PayOrderResult> => ({ error: "Payment is coming soon" });

/* ── Real pay flow — restore when a payment gateway is wired ──────────────────
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getUserOrder, markOrderPaid } from "services";

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
──────────────────────────────────────────────────────────────────────────── */
