import { getHandoversAction } from "@/app/(dashboard)/handovers/action";
import { HANDOVER_STATUS_LABELS } from "@/db/label";
import { CircleCheck, CircleDot, Hourglass } from "lucide-react";

// Where every installation has got to. Read-only — verification belongs to the
// pre-seller who managed the BOQ, and two surfaces able to sign off one job is
// how a decision gets overwritten by somebody who never saw it.

export const HandoverBoard = async () => {
  const packs = await getHandoversAction();

  if (packs.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-10 text-center text-sm text-faint">
        No handover packs yet. One is created when a partner finishes on site.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {packs.map((pack) => (
        <div
          key={pack.uuid}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              {pack.boqReference ?? "Unknown project"}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              {pack.status === "verified" ? (
                <CircleCheck size={11} className="text-emerald-400" />
              ) : pack.status === "customer_confirmed" ? (
                <CircleDot size={11} className="text-amber-400" />
              ) : (
                <Hourglass size={11} />
              )}
              {HANDOVER_STATUS_LABELS[pack.status]}
              {pack.sotVerifiedByName && ` · by ${pack.sotVerifiedByName}`}
              {pack.submittedAt &&
                ` · submitted ${new Date(pack.submittedAt).toLocaleDateString()}`}
            </p>
          </div>

          {/* Named plainly rather than as a status badge: "waiting on the
              customer" is what somebody reading this needs, and the status enum
              does not say whose turn it is. */}
          <span className="shrink-0 text-[11px] text-secondary">
            {pack.status === "submitted"
              ? "Waiting on the customer"
              : pack.status === "customer_confirmed"
                ? "Waiting on our verification"
                : pack.status === "verified"
                  ? "Waiting on completion"
                  : "With the partner"}
          </span>
        </div>
      ))}
    </div>
  );
};
