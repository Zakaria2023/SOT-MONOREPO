"use client";

import {
  complete,
  dispute,
  verify,
} from "@/app/(dashboard)/handovers/[uuid]/actions";
import type { HandoverStatus } from "@/db/enum";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

type ReviewControlsProps = {
  boqUuid: string;
  status: HandoverStatus;
};

export const ReviewControls = ({ boqUuid, status }: ReviewControlsProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState("");

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(undefined);
      const result = await fn();
      if (result.error) setError(result.error);
    });

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {status === "customer_confirmed" && (
          <button
            type="button"
            onClick={() => run(() => verify(boqUuid))}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <ShieldCheck size={16} />
            Verify (remote check)
          </button>
        )}

        {status === "verified" && (
          <button
            type="button"
            onClick={() => run(() => complete(boqUuid))}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            Complete handover &amp; release
          </button>
        )}
      </div>

      {status !== "verified" && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Reason to dispute (routes to physical inspection)…"
            className="w-full rounded-control border border-hairline bg-surface p-3 text-sm text-ink outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => run(() => dispute(boqUuid, reason))}
            disabled={isPending || !reason.trim()}
            className="inline-flex w-fit items-center rounded-xl border border-danger px-5 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-tint disabled:opacity-60"
          >
            Dispute
          </button>
        </div>
      )}
    </div>
  );
};
