import { Banknote, CheckCircle2 } from "lucide-react";
import { formatMoney } from "utils";

// E8 — cash only.
//
// This was a card form: name, number, expiry, CVC, and a simulated gateway that
// waited 1.2 seconds and marked the order paid. It charged nothing and it
// collected card details that went nowhere, which is worse than no form at all.
//
// Cash is handed to a person, so there is nothing here for the customer to
// press. What they need is the amount, the reference to quote, and confirmation
// once it lands. A disabled Pay button would teach them the site is broken; no
// button with instructions beside it teaches them what to do.
//
// Not a client component any more either — there is no state left to hold.

type OrderPaymentProps = {
  reference: string;
  total: string;
  currency: string | null;
  paidAt: Date | null;
  paymentReference: string | null;
};

export const OrderPayment = ({
  reference,
  total,
  currency,
  paidAt,
  paymentReference,
}: OrderPaymentProps) => {
  if (paidAt) {
    return (
      <div className="flex flex-col gap-2 rounded-[18px] border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-grotesk flex items-center gap-2 text-sm font-medium text-emerald-900">
          <CheckCircle2 size={18} className="text-emerald-600" />
          Paid on {new Date(paidAt).toLocaleDateString()}
        </p>
        {/* Shown back so the customer can match it against their own receipt. */}
        {paymentReference && (
          <p className="font-grotesk text-xs text-emerald-800">
            Recorded against {paymentReference}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-hairline bg-surface p-5">
      <p className="font-grotesk flex items-center gap-2 text-sm font-medium text-ink">
        <Banknote size={18} className="text-primary" />
        Payment in cash
      </p>

      <div className="font-grotesk flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Amount due</span>
          <span className="font-heading text-xl tabular-nums text-ink">
            {formatMoney(Number(total), currency ?? "SAR")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Quote this reference</span>
          <span className="font-mono text-ink">{reference}</span>
        </div>
      </div>

      <p className="font-grotesk text-xs text-muted">
        Settle with our team and quote the reference above. This page updates as
        soon as the payment is recorded against your order.
      </p>
    </div>
  );
};
