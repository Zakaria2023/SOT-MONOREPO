import { HandoverView } from "@/components/handover/handover-view";
import { getCurrentUser } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getCustomerHandover, getUserBoq } from "services";

export const metadata: Metadata = {
  title: "Handover · Stratum",
};

type Props = {
  params: Promise<{ uuid: string }>;
};

const HandoverPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const [boq, handover] = await Promise.all([
    getUserBoq(user.uuid, uuid),
    getCustomerHandover(user.uuid, uuid),
  ]);
  if (!boq) {
    notFound();
  }

  return (
    <main className="mx-auto px-6 py-12 lg:px-12 xl:px-20">
      <Link
        href={`/boq/${uuid}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft size={16} />
        Back to BOQ
      </Link>

      <h1 className="font-heading mt-3 text-2xl text-ink">
        Handover · {boq.boq.reference}
      </h1>

      {handover ? (
        <div className="mt-6">
          <HandoverView
            boqUuid={uuid}
            pack={handover.pack}
            assets={handover.assets}
            credentials={handover.credentials}
          />
        </div>
      ) : (
        <p className="font-grotesk mt-6 text-sm text-muted">
          Your installer is still preparing the handover. Once they submit it,
          your credentials, device records, and access will appear here for you
          to confirm — and stay in your account permanently.
        </p>
      )}
    </main>
  );
};

export default HandoverPage;
