"use client";

import { recordCashAction } from "@/app/(dashboard)/orders/action";
import { Banknote } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, Input } from "ui";

// Recording cash asks for the reference before it does anything.
//
// This is the only way an order gets settled now — there is no gateway and no
// callback. A payment recorded against nothing cannot be reconciled against a
// till or a deposit slip, and "paid" would then mean only that somebody clicked.
//
// The person is taken from the session rather than a field: whoever is signed in
// is who received it, and a name typed into a box is a name anybody can type.

type RecordCashButtonProps = {
  orderUuid: string;
  amount: string;
  currency: string;
};

export const RecordCashButton = ({
  orderUuid,
  amount,
  currency,
}: RecordCashButtonProps) => {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const record = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await recordCashAction(
        orderUuid,
        reference,
        note.trim() || null,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReference("");
      setNote("");
    });
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Banknote size={14} />
        Record cash
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-card border border-primary/40 bg-surface p-3">
      <p className="text-xs text-muted">
        Recording {amount} {currency} received in cash. This issues the tax
        invoice.
      </p>
      <Input
        label="Receipt or deposit reference"
        placeholder="RCPT-00412"
        value={reference}
        onChange={(event) => setReference(event.target.value)}
      />
      <Input
        label="Note (optional)"
        placeholder="Collected at the Riyadh office"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      {error && (
        <p className="rounded-control border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-control px-3 py-2 text-xs text-secondary hover:bg-hover hover:text-ink"
        >
          Cancel
        </button>
        <Button onClick={record} disabled={pending || reference.trim() === ""}>
          {pending ? "Recording…" : "Confirm receipt"}
        </Button>
      </div>
    </div>
  );
};
