import { ReviewControls } from "@/components/handovers/review-controls";
import {
  HANDOVER_CREDENTIAL_TYPE_LABELS,
  HANDOVER_STATUS_LABELS,
} from "@/db/label";
import { requirePreSeller } from "@/lib/server/auth";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHandoverForReview } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const HandoverReviewPage = async ({ params }: Props) => {
  await requirePreSeller();
  const { uuid } = await params;

  const detail = await getHandoverForReview(uuid);
  if (!detail) {
    notFound();
  }

  const { pack, assets, credentials } = detail;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/handovers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Handovers
        </Link>
        <h1 className="font-heading mt-3 text-2xl text-ink">Handover review</h1>
        <p className="mt-1 text-sm text-muted">
          Status:{" "}
          <span className="font-medium text-ink">
            {HANDOVER_STATUS_LABELS[pack.status]}
          </span>
        </p>
      </div>

      <section className="rounded-card border border-hairline bg-surface p-6">
        <h2 className="font-heading text-lg text-ink">Devices ({assets.length})</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {assets.map((asset) => (
            <div key={asset.uuid} className="flex justify-between text-muted">
              <span className="text-ink">{asset.name}</span>
              <span>
                {[asset.location, asset.localIp, asset.port]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-card border border-hairline bg-surface p-6">
        <h2 className="font-heading text-lg text-ink">
          Credentials ({credentials.length})
        </h2>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {credentials.map((cred) => (
            <div key={cred.uuid} className="flex justify-between text-muted">
              <span className="text-ink">{cred.label}</span>
              <span>{HANDOVER_CREDENTIAL_TYPE_LABELS[cred.type]}</span>
            </div>
          ))}
          {credentials.length === 0 && (
            <p className="text-danger">No credentials recorded.</p>
          )}
        </div>
      </section>

      {pack.disputeReason && (
        <p className="rounded-control bg-danger-tint p-4 text-sm text-danger">
          {pack.disputeReason}
        </p>
      )}

      <section className="rounded-card border border-hairline bg-surface p-6">
        <h2 className="font-heading text-lg text-ink">Actions</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Confirm credentials are present, cloud admin is transferred, and the
          customer has confirmed. Completing releases the partner's payment.
        </p>
        <ReviewControls boqUuid={uuid} status={pack.status} />
      </section>
    </div>
  );
};

export default HandoverReviewPage;
