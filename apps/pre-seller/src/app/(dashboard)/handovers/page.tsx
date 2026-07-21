import { HANDOVER_STATUS_LABELS } from "@/db/label";
import { requirePreSeller } from "@/lib/server/auth";
import Link from "next/link";
import { listHandoversForReview } from "services";

const HandoversPage = async () => {
  await requirePreSeller();

  const handovers = await listHandoversForReview();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl text-ink">Handovers</h1>
        <p className="mt-1 text-sm text-muted">
          Packs awaiting a remote completeness check, release, or dispute
          handling.
        </p>
      </div>

      {handovers.length === 0 ? (
        <p className="text-sm text-muted">Nothing to review right now.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {handovers.map((pack) => (
            <Link
              key={pack.uuid}
              href={`/handovers/${pack.boqUuid}`}
              className="flex items-center justify-between rounded-card border border-hairline bg-surface p-5 transition-colors hover:bg-hover"
            >
              <span className="font-semibold text-ink">
                {pack.boqReference ?? pack.boqUuid.slice(0, 8)}
              </span>
              <span className="text-sm text-muted">
                {HANDOVER_STATUS_LABELS[pack.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default HandoversPage;
