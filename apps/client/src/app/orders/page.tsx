import { getCurrentUser } from "@/lib/auth";
import { ORDER_STATUS_LABELS } from "@/db/label";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney } from "utils";
import { getUserOrders } from "services";

export const metadata: Metadata = {
  title: "Your orders · Stratum",
};

const OrdersPage = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const orders = await getUserOrders(user.uuid);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
      <h1 className="font-heading text-2xl text-ink">Your orders</h1>

      {orders.length === 0 ? (
        <p className="font-grotesk mt-6 text-sm text-muted">
          No orders yet. Confirm an offer on one of your BOQs to place an order.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {orders.map((order) => (
            <Link
              key={order.uuid}
              href={`/orders/${order.uuid}`}
              className="flex items-center justify-between rounded-[18px] border border-search-border p-5 transition-colors hover:bg-hover"
            >
              <div>
                <p className="font-semibold text-ink">{order.reference}</p>
                <p className="text-xs text-muted">
                  {order.boqReference ?? "—"} ·{" "}
                  {ORDER_STATUS_LABELS[order.status]}
                </p>
              </div>
              <span className="font-semibold tabular-nums text-ink">
                {formatMoney(Number(order.grandTotal), order.currency ?? "SAR")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
};

export default OrdersPage;
