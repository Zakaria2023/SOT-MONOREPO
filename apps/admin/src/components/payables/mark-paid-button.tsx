"use client";

import { markPayoutPaidAction } from "@/app/(dashboard)/payables/action";
import { useState, useTransition } from "react";
import { Button, Input } from "ui";

// The reference is asked for before the button does anything. SOT does not move
// the money — a bank does — so this row is the ledger catching up, and one that
// cannot be matched against a statement is an assertion rather than a record.

type MarkPaidButtonProps = {
  payoutUuid: string;
};

export const MarkPaidButton = ({ payoutUuid }: MarkPaidButtonProps) => {
  const [asking, setAsking] = useState(false);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const record = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await markPayoutPaidAction(payoutUuid, reference);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAsking(false);
      setReference("");
    });
  };

  if (!asking) {
    return (
      <Button onClick={() => setAsking(true)}>Record the transfer</Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-end gap-2">
        <Input
          placeholder="Bank transfer reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <Button onClick={record} disabled={pending || reference.trim() === ""}>
          {pending ? "Recording…" : "Confirm"}
        </Button>
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
};
