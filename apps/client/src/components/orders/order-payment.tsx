import { Clock } from "lucide-react";

type OrderPaymentProps = {
  orderUuid: string;
  total: string;
};

// Payment is not available yet — there is no gateway. This renders a
// "coming soon" placeholder. The real pay flow is commented out at the bottom
// of this file; restore it (and payOrder in the actions) when a licensed
// provider (SAMA) is wired.
export const OrderPayment = ({ total }: OrderPaymentProps) => (
  <div className="flex flex-col items-start gap-3">
    <p className="font-grotesk flex items-center gap-2 text-sm text-secondary">
      <Clock size={16} className="text-primary" />
      Payment is coming soon. Your order ({total}) is reserved — you'll be able
      to pay securely through SOT once checkout is live.
    </p>
    <span className="inline-flex items-center gap-2 rounded-xl bg-hover px-6 py-3 text-sm font-semibold text-faint">
      Payment coming soon
    </span>
  </div>
);

/* ── Real payment flow — restore when a payment gateway is wired ──────────────
"use client";

import { payOrder } from "@/app/orders/[uuid]/actions";
import { CreditCard, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

export const OrderPayment = ({ orderUuid, total }: OrderPaymentProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const onPay = () => {
    startTransition(async () => {
      setError(undefined);
      const result = await payOrder(orderUuid);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="font-grotesk flex items-center gap-2 text-sm text-secondary">
        <ShieldCheck size={16} className="text-primary" />
        Your payment is held by SOT and only released to the installer once your
        system is verified and handed over.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="button"
        onClick={onPay}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
      >
        <CreditCard size={16} />
        {isPending ? "Processing…" : `Pay ${total}`}
      </button>
      <p className="text-xs text-faint">
        Demo checkout — a licensed payment gateway is wired here at launch.
      </p>
    </div>
  );
};
──────────────────────────────────────────────────────────────────────────── */
