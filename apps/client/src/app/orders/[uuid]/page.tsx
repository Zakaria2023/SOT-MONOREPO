import { OrderPayment } from "@/components/orders/order-payment";
import { getCurrentUser } from "@/lib/auth";
import { ORDER_STATUS_LABELS } from "@/db/label";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { formatMoney } from "utils";
import { getUserOrder } from "services";

export const metadata: Metadata = {
  title: "Your order · Stratum",
};

type Props = {
  params: Promise<{ uuid: string }>;
};

const OrderPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const order = await getUserOrder(user.uuid, uuid);
  if (!order) {
    notFound();
  }

  const currency = order.currency ?? "SAR";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
      <h1 className="font-heading text-2xl text-ink">Order {order.reference}</h1>
      <p className="font-grotesk mt-1 text-sm text-muted">
        {ORDER_STATUS_LABELS[order.status]}
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-[18px] border border-search-border bg-surface p-6">
        <div className="flex justify-between text-sm text-muted">
          <span>Products</span>
          <span className="font-medium text-ink">
            {formatMoney(Number(order.productTotal), currency)}
          </span>
        </div>
        <div className="flex justify-between text-sm text-muted">
          <span>Service</span>
          <span className="font-medium text-ink">
            {formatMoney(Number(order.serviceTotal), currency)}
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-hairline-soft pt-3 text-base">
          <span className="font-semibold text-ink">Total</span>
          <span className="font-semibold text-ink">
            {formatMoney(Number(order.grandTotal), currency)}
          </span>
        </div>
      </div>

      {/* Payment is disabled for now (coming soon). The order is reserved; the
          paid/invoice branch is removed until a gateway is wired. */}
      <div className="mt-8 flex flex-col gap-4">
        <OrderPayment
          orderUuid={order.uuid}
          total={formatMoney(Number(order.grandTotal), currency)}
        />
        <Link
          href={`/boq/${order.boqUuid}/handover`}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-search-border px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-hover"
        >
          <FileText size={16} />
          View handover
        </Link>
      </div>
    </main>
  );
};

export default OrderPage;
