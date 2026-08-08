import { OrderPayment } from "@/components/orders/order-payment";
import { OrderTracking } from "@/components/orders/order-tracking";
import { getCurrentUser } from "@/lib/auth";
import { ORDER_STATUS_LABELS } from "@/db/label";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";
import { formatMoney } from "utils";
import { getInvoiceForOrder, getOrderItems, getUserOrder } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

// Path-less canonical would be wrong here and a real one would leak an order id
// into a crawlable URL, so this page carries noindex and nothing else.
export const metadata: Metadata = pageMetadata({
  title: "Your order",
  description: "Order details, payment status and invoice.",
  path: "/orders",
  noIndex: true,
});

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
  const [invoice, items] = await Promise.all([
    order.status === "paid" ? getInvoiceForOrder(order.uuid) : null,
    getOrderItems(order.uuid),
  ]);

  return (
    <main className="mx-auto px-6 py-12 lg:px-12 xl:px-20">
      <h1 className="font-heading text-2xl text-ink">Order {order.reference}</h1>
      <p className="font-grotesk mt-1 text-sm text-muted">
        {ORDER_STATUS_LABELS[order.status]}
      </p>

      {/* E9. Above the line items, because "where has this got to" is why the
          customer opened the page — they know what they ordered. */}
      <div className="mt-6">
        <OrderTracking orderStatus={order.status} boqStatus={order.boqStatus} />
      </div>

      {items.length > 0 && (
        <div className="mt-6 flex flex-col divide-y divide-hairline-soft rounded-[18px] border border-search-border bg-surface p-6">
          {items.map((item) => (
            <div
              key={item.uuid}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 text-sm"
            >
              <span className="text-ink">
                {item.name}
                <span className="text-faint"> × {item.quantity}</span>
              </span>
              <span className="font-medium tabular-nums text-ink">
                {formatMoney(Number(item.lineTotal), currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 rounded-[18px] border border-search-border bg-surface p-6">
        <div className="flex justify-between text-sm text-muted">
          <span>Products</span>
          <span className="font-medium text-ink">
            {formatMoney(Number(order.productTotal), currency)}
          </span>
        </div>
        {Number(order.serviceTotal) > 0 && (
          <div className="flex justify-between text-sm text-muted">
            <span>Service</span>
            <span className="font-medium text-ink">
              {formatMoney(Number(order.serviceTotal), currency)}
            </span>
          </div>
        )}
        {order.discountPercent > 0 && (
          <div className="flex justify-between text-sm text-muted">
            <span>Partner discount</span>
            <span className="font-medium text-primary">
              {order.discountPercent}% applied
            </span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-hairline-soft pt-3 text-base">
          <span className="font-semibold text-ink">Total</span>
          <span className="font-semibold text-ink">
            {formatMoney(Number(order.grandTotal), currency)}
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {/* Rendered for `paid` as well as `awaiting_payment`, which it was not.
            OrderPayment carries both branches — the cash instructions and, once
            settled, the "Paid on" panel with the invoice open/download links — but
            the page only mounted it while the order was unpaid, so the paid branch
            was unreachable and the invoice PDF had no way in from this page. The
            component decides which half to show; that is what `paidAt` is for. */}
        {order.status === "awaiting_payment" || order.status === "paid" ? (
          <OrderPayment
            orderUuid={order.uuid}
            reference={order.reference}
            total={order.grandTotal}
            currency={order.currency}
            paidAt={order.paidAt}
            paymentReference={order.paymentReference}
          />
        ) : null}

        {order.status === "paid" && (
          <p className="font-grotesk flex items-center gap-2 text-sm text-secondary">
            <CheckCircle2 size={16} className="text-primary" />
            {invoice ? `Invoice ${invoice.number}. ` : ""}Your funds are held by
            SOT until your system is handed over and verified.
          </p>
        )}
        {order.boqUuid && (
          <Link
            href={`/boq/${order.boqUuid}/handover`}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-search-border px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-hover"
          >
            <FileText size={16} />
            View handover
          </Link>
        )}
      </div>
    </main>
  );
};

export default OrderPage;
