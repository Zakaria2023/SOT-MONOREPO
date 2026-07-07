"use client";

import { submitBoq } from "@/app/boqs/[uuid]/actions";
import { Send } from "lucide-react";
import { useState, useTransition } from "react";

type SubmitBoqButtonProps = {
  boqUuid: string;
};

export const SubmitBoqButton = ({ boqUuid }: SubmitBoqButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const onSubmit = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await submitBoq(boqUuid);
      if (result.error) setError(result.error);
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
      >
        <Send size={16} />
        {isPending ? "Sending to partners…" : "Submit & send to partners"}
      </button>
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : (
        <p className="text-xs text-neutral-400">
          Sends this BOQ to the three partners closest to the customer.
        </p>
      )}
    </div>
  );
};
