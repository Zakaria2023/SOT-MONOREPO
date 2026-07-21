import {
  HandoverBuilder,
  OpenPackButton,
} from "@/components/handover/handover-builder";
import { HANDOVER_STATUS_LABELS } from "@/db/label";
import { requirePartner } from "@/lib/server/auth";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartnerBoq, getPartnerHandover } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const PartnerHandoverPage = async ({ params }: Props) => {
  const user = await requirePartner();
  const { uuid } = await params;

  const [boq, handover] = await Promise.all([
    getPartnerBoq(user.id, uuid),
    getPartnerHandover(user.id, uuid),
  ]);
  if (!boq) {
    notFound();
  }

  const installed = boq.boq.status === "installed";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href={`/boqs/${uuid}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to BOQ
        </Link>
        <h1 className="font-heading mt-3 text-2xl text-ink">
          Handover · {boq.boq.reference}
        </h1>
      </div>

      {handover ? (
        handover.pack.status === "draft" ? (
          <HandoverBuilder
            boqUuid={uuid}
            assets={handover.assets}
            credentials={handover.credentials}
          />
        ) : (
          <p className="rounded-card border border-hairline bg-surface p-6 text-sm text-muted">
            Handover status:{" "}
            <span className="font-semibold text-ink">
              {HANDOVER_STATUS_LABELS[handover.pack.status]}
            </span>
            . Nothing more to do until the customer and SOT complete their
            checks.
          </p>
        )
      ) : installed ? (
        <div className="rounded-card border border-hairline bg-surface p-6">
          <p className="text-sm text-muted">
            The install is done. Open the handover pack to record the as-built
            devices and access credentials.
          </p>
          <div className="mt-4">
            <OpenPackButton boqUuid={uuid} />
          </div>
        </div>
      ) : (
        <p className="rounded-card border border-hairline bg-surface p-6 text-sm text-muted">
          The handover pack opens once this BOQ is marked installed.
        </p>
      )}
    </div>
  );
};

export default PartnerHandoverPage;
