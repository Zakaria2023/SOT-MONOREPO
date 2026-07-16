"use client";

import { payOrder } from "@/app/orders/[uuid]/actions";
import { CreditCard, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

type OrderPaymentProps = {
  orderUuid: string;
  total: string;
};

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
