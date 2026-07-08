import { requirePreSeller } from "@/lib/server/auth";
import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { getAssignedBoqs } from "services";

const DashboardPage = async () => {
  const user = await requirePreSeller();
  const boqs = await getAssignedBoqs(user.id);
  const drafts = boqs.filter((boq) => boq.status === "draft").length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/boqs"
        className="flex max-w-xl items-center justify-between gap-4 rounded-card border border-hairline bg-surface p-6 shadow-[0_1px_2px_rgba(27,35,51,0.04)] transition-colors hover:border-primary-tint-border"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-control bg-primary-tint text-primary">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="font-heading text-lg text-ink">Assigned BOQs</h2>
            <p className="mt-0.5 text-sm text-muted">
              {boqs.length} assigned · {drafts} awaiting review
            </p>
          </div>
        </div>
        <ArrowRight size={20} className="text-primary" />
      </Link>
    </div>
  );
};

export default DashboardPage;
