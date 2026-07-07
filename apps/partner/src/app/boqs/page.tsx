import { requirePartner } from "@/lib/server/auth";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getPartnerBoqs } from "services";

const BoqsPage = async () => {
  const user = await requirePartner();
  const boqs = await getPartnerBoqs(user.id);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <Link
        href="/"
        className="text-sm font-medium text-neutral-500 transition-colors hover:text-primary"
      >
        ← Dashboard
      </Link>

      <h1 className="font-heading mt-4 text-4xl text-ink">Incoming BOQs</h1>
      <p className="mt-2 text-neutral-500">
        Bills of quantities a pre-seller has sent to you.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200">
        {boqs.length === 0 ? (
          <p className="p-8 text-center text-neutral-500">
            No BOQs sent to you yet.
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
                    <p className="font-heading text-lg font-semibold text-ink">
                      {boq.reference}
                    </p>
                    <p className="text-sm text-neutral-500">
                      Sent {new Date(boq.dispatchedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      #{boq.matchRank} match
                    </span>
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
