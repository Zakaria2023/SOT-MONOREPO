"use client";

import { settlePayout } from "@/app/(dashboard)/payouts/actions";
import { useState, useTransition } from "react";

// Marking a payout paid asks for the bank's reference first.
//
// It used to be one click. The money moves through a bank and this row is the
// ledger catching up with it, so a payout marked paid with nothing to match
// against a statement is an assertion rather than a record — and the person who
// has to reconcile it later is not the person clicking.

type SettleButtonProps = {
  payoutUuid: string;
};

export const SettleButton = ({ payoutUuid }: SettleButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [reference, setReference] = useState("");

  const onSettle = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await settlePayout(payoutUuid, reference);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAsking(false);
      setReference("");
    });

  if (!asking) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="inline-flex items-center rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Mark paid
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <input
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        placeholder="Bank transfer reference"
        className="w-56 rounded-control border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="rounded-control px-3 py-2 text-sm text-secondary hover:bg-hover hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSettle}
          disabled={isPending || reference.trim() === ""}
          className="inline-flex items-center rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {isPending ? "Recording…" : "Record the transfer"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
