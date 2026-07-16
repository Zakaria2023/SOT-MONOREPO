"use client";

import { cashOut } from "@/app/(dashboard)/earnings/actions";
import { Banknote } from "lucide-react";
import { useState, useTransition } from "react";

type CashOutButtonProps = {
  disabled: boolean;
};

export const CashOutButton = ({ disabled }: CashOutButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const onCashOut = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await cashOut();
      if (result.error) setError(result.error);
    });

  return (
    <div className="flex flex-col items-start gap-2">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="button"
        onClick={onCashOut}
        disabled={disabled || isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
      >
        <Banknote size={16} />
        {isPending ? "Requesting…" : "Cash out"}
      </button>
    </div>
  );
};
