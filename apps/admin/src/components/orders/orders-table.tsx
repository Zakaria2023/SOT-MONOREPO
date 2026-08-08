import { getOrdersPage } from "@/app/(dashboard)/orders/action";
import { RecordCashButton } from "@/components/orders/record-cash-button";
import { Pagination } from "@/components/shared/pagination";
import Link from "next/link";
import { formatMoney } from "utils";

type OrdersTableProps = {
  search?: string;
  page?: string;
};

// Orders had no admin surface at all. That was survivable while a simulated
// gateway settled them by itself; with cash it is the whole flow — an order
// only becomes paid because somebody here found it and recorded the money.

export const OrdersTable = async ({ search, page }: OrdersTableProps) => {
  const result = await getOrdersPage({ search, page });

  if (result.items.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-10 text-center text-sm text-faint">
        {search ? `Nothing matches “${search}”.` : "No orders yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {result.items.map((order) => (
          <div
            key={order.uuid}
            className="flex flex-wrap items-start justify-between gap-4 rounded-card border border-hairline bg-surface px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{order.reference}</p>
              <p className="text-[11px] text-muted">
                {order.customerName ? (
                  <Link
                    href={`/users/${order.userUuid}`}
                    className="hover:text-primary"
                  >
                    {order.customerName}
                  </Link>
                ) : (
                  "Unknown customer"
                )}{" "}
                · {new Date(order.createdAt).toLocaleDateString()}
                {order.invoiceNumber && ` · ${order.invoiceNumber}`}
              </p>

              {order.paidAt ? (
                <p className="text-[11px] text-emerald-500">
                  Cash recorded by {order.paidBy ?? "—"} against{" "}
                  {order.paymentReference ?? "no reference"} on{" "}
                  {new Date(order.paidAt).toLocaleDateString()}
                  {order.paymentNote && ` — ${order.paymentNote}`}
                </p>
              ) : (
                <p className="text-[11px] text-amber-500">Awaiting payment</p>
              )}

              {/* The most important thing on the row when it exists: this order
                  went through despite the engine refusing it. */}
              {order.designOverrideReason && (
                <p className="text-[11px] text-red-400">
                  Design overridden: {order.designOverrideReason}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-heading text-lg text-ink">
                {formatMoney(
                  Number(order.grandTotal),
                  order.currency ?? "SAR",
                )}
              </span>
              {order.status === "awaiting_payment" && (
                <RecordCashButton
                  orderUuid={order.uuid}
                  amount={formatMoney(
                    Number(order.grandTotal),
                    order.currency ?? "SAR",
                  )}
                  currency=""
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <Pagination {...result} />
    </div>
  );
};
