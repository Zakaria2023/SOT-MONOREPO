import { getUserFromRequest, unauthorized } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { getInvoiceForOrder, getOrderItems, getUserOrder } from "services";

type Context = {
  params: Promise<{ uuid: string }>;
};

/**
 * One order the caller owns, with its lines and its invoice if one was raised.
 *
 * Ownership-scoped by `getUserOrder` rather than filtered after the read: a
 * missing row and someone else's row must be indistinguishable from here, or the
 * 404 tells the caller which order uuids exist.
 */
export const GET = async (request: Request, context: Context) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const { uuid } = await context.params;
  const order = await getUserOrder(user.uuid, uuid);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const [items, invoice] = await Promise.all([
    getOrderItems(order.uuid),
    getInvoiceForOrder(order.uuid),
  ]);

  return NextResponse.json({ order, items, invoice });
};
