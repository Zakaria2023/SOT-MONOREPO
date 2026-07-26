"use client";

import { settlePayout } from "@/app/(dashboard)/payouts/actions";
import { useState, useTransition } from "react";

type SettleButtonProps = {
  payoutUuid: string;
};

export const SettleButton = ({ payoutUuid }: SettleButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const onSettle = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await settlePayout(payoutUuid);
      if (result.error) {
        setError(result.error);
      }
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onSettle}
        disabled={isPending}
        className="inline-flex items-center rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Settling…" : "Mark paid"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
