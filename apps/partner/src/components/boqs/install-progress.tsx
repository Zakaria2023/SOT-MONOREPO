"use client";

import { advanceStage } from "@/app/(dashboard)/boqs/[uuid]/actions";
import { BOQ_STATUS_LABELS } from "@/db/label";
import type { BoqStatus } from "@/db/enum";
import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

type InstallProgressProps = {
  boqUuid: string;
  status: BoqStatus;
};

// Which stage each current stage advances to, and the button copy.
const NEXT: Partial<Record<BoqStatus, { to: BoqStatus; label: string }>> = {
  ordered: { to: "assigned", label: "Accept assignment" },
  assigned: { to: "installing", label: "Start install" },
  installing: { to: "installed", label: "Mark installed" },
};

export const InstallProgress = ({ boqUuid, status }: InstallProgressProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const next = NEXT[status];

  const onAdvance = (to: BoqStatus) =>
    startTransition(async () => {
      setError(undefined);
      const result = await advanceStage(boqUuid, to);
      if (result.error) setError(result.error);
    });

  return (
    <section className="rounded-card border border-hairline bg-surface p-6 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg text-ink">Fulfilment</h2>
          <p className="mt-0.5 text-sm text-muted">
            Stage: <span className="font-medium text-ink">
              {BOQ_STATUS_LABELS[status]}
            </span>
          </p>
        </div>

        {next && (
          <button
            type="button"
            onClick={() => onAdvance(next.to)}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
          >
            {isPending ? "Saving…" : next.label}
            <ArrowRight size={15} />
          </button>
        )}

        {(status === "installed" ||
          status === "verified" ||
          status === "handed_over") && (
          <Link
            href={`/boqs/${boqUuid}/handover`}
            className="inline-flex items-center gap-2 rounded-xl border border-hairline px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-hover"
          >
            <FileText size={15} />
            Handover
          </Link>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </section>
  );
};
