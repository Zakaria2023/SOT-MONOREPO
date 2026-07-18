import { formatMoney, lineTotal, summarizeCart } from "utils";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Package } from "lucide-react";
import Link from "next/link";
import type { SelectBoqItems, SelectBoqs } from "services";

type BoqViewProps = {
  boq: SelectBoqs;
  items: SelectBoqItems[];
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
};

export const BoqView = ({ boq, items }: BoqViewProps) => {
  const currency = items[0]?.currency ?? "SAR";
  const { subtotal, vat, total } = summarizeCart(items);
  const status = boq.status ?? "draft";
  const isDraft = status === "draft";

  return (
    <main className="w-full bg-surface">
      <div className="mx-auto px-6 py-12 lg:px-12 xl:px-20">
        <Link
          href="/cart"
          className="font-grotesk inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to cart
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-4xl text-ink">Bill of Quantities</h1>
          <span
            className={cn(
              "font-grotesk rounded-full px-3 py-1 text-xs font-bold",
              isDraft
                ? "bg-primary-tint text-primary"
                : "bg-green-50 text-green-700",
            )}
          >
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>
        <p className="font-grotesk mt-1 text-sm text-faint">
          {boq.reference} · {items.length}{" "}
          {items.length === 1 ? "item" : "items"}
        </p>

        <div className="mt-8 grid gap-7 lg:grid-cols-[1.6fr_380px]">
          <div className="rounded-[18px] border border-hairline bg-surface shadow-[0_18px_40px_-24px_rgba(20,22,27,0.12)]">
            {items.map((item, index) => (
              <div
                key={item.uuid}
                className={cn(
                  "flex items-center gap-4 p-5",
                  index > 0 && "border-t border-hairline",
                )}
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-primary-tint">
                  <Package size={26} className="text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  {item.categoryName && (
                    <p className="font-grotesk text-xs text-faint">
                      {item.categoryName}
                    </p>
                  )}
                  <p className="font-heading text-base font-bold text-ink">
                    {item.name}
                  </p>
                  <p className="font-grotesk text-xs text-faint">
                    {formatMoney(Number(item.unitPrice), currency)} each
                  </p>
                </div>

                <span className="font-grotesk text-sm font-medium text-muted">
                  Qty {item.quantity}
                </span>

                <span className="font-grotesk w-24 text-right text-base font-bold tabular-nums text-ink">
                  {formatMoney(
                    lineTotal(item.unitPrice, item.quantity),
                    currency,
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="h-fit rounded-[18px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_-24px_rgba(20,22,27,0.12)] lg:sticky lg:top-24">
            <h2 className="font-heading text-xl text-ink">Summary</h2>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-grotesk text-muted">Subtotal</span>
                <span className="font-grotesk font-medium tabular-nums text-ink">
                  {formatMoney(subtotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-grotesk text-muted">VAT (15%)</span>
                <span className="font-grotesk font-medium tabular-nums text-ink">
                  {formatMoney(vat, currency)}
                </span>
              </div>
            </div>

            <div className="my-5 border-t border-hairline" />

            <div className="flex items-center justify-between">
              <span className="font-grotesk text-base font-medium text-ink">
                Total
              </span>
              <span className="font-heading text-3xl tabular-nums text-ink">
                {formatMoney(total, currency)}
              </span>
            </div>

            <div className="mt-6 flex items-start gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span className="font-grotesk">
                {isDraft
                  ? "Your BOQ has been sent to our team. A pre-seller will review it and get back to you."
                  : "Submitted for review. A pre-seller will get back to you."}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
