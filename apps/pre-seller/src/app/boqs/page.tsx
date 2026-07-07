import { requirePreSeller } from "@/lib/server/auth";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getSubmittedBoqs } from "services";

const BoqsPage = async () => {
  const user = await requirePreSeller();
  const boqs = await getSubmittedBoqs();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <Link
        href="/"
        className="text-sm font-medium text-neutral-500 transition-colors hover:text-primary"
      >
        ← Dashboard
      </Link>

      <h1 className="font-heading mt-4 text-4xl text-ink">Review queue</h1>
      <p className="mt-2 text-neutral-500">
        BOQs customers have submitted for review.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200">
        {boqs.length === 0 ? (
          <p className="p-8 text-center text-neutral-500">
            No BOQs submitted yet.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {boqs.map((boq) => (
              <li key={boq.uuid}>
                <Link
                  href={`/boqs/${boq.uuid}`}
                  className="flex items-center justify-between gap-4 p-5 transition-colors hover:bg-neutral-50"
                >
                  <div>
                    <p className="font-heading text-lg font-bold text-ink">
                      {boq.reference}
                    </p>
                    <p className="text-sm text-neutral-500">
                      Submitted{" "}
                      {boq.submittedAt
                        ? new Date(boq.submittedAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {boq.assignedPreSellerId === user.id ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        Assigned to you
                      </span>
                    ) : boq.assignedPreSellerName ? (
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
                        {boq.assignedPreSellerName}
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-400">
                        Unassigned
                      </span>
                    )}
                    <ArrowRight size={18} className="text-primary" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};

export default BoqsPage;
