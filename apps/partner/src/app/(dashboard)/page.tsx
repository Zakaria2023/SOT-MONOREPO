import { requirePartner } from "@/lib/server/auth";
import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { getPartnerBoqs } from "services";

const DashboardPage = async () => {
  const user = await requirePartner();
  const boqs = await getPartnerBoqs(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold tracking-wider text-primary uppercase">
          Partner
        </p>
        <h1 className="font-heading mt-2 text-2xl text-ink">
          Welcome, {user.firstName ?? "there"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Bills of quantities our team sends you show up here. Open one to send
          your offer.
        </p>
      </div>

      <Link
        href="/boqs"
        className="flex max-w-xl items-center justify-between gap-4 rounded-card border border-hairline bg-surface p-6 shadow-[0_1px_2px_rgba(27,35,51,0.04)] transition-colors hover:border-primary-tint-border"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-control bg-primary-tint text-primary">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="font-heading text-lg text-ink">Incoming BOQs</h2>
            <p className="mt-0.5 text-sm text-muted">
              {boqs.length} sent to you
            </p>
          </div>
        </div>
        <ArrowRight size={20} className="text-primary" />
      </Link>
    </div>
  );
};

export default DashboardPage;
