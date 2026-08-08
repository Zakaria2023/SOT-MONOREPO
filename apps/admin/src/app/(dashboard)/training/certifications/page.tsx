import {
  getCertificatesAction,
  getLapsedCapabilitiesAction,
} from "@/app/(dashboard)/training/action";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";
import { CertificationBoard } from "@/components/training/certification-board";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const Board = async () => {
  const [certificates, lapsed] = await Promise.all([
    getCertificatesAction(),
    getLapsedCapabilitiesAction(),
  ]);
  return <CertificationBoard certificates={certificates} lapsed={lapsed} />;
};

const CertificationsPage = () => (
  <div className="flex flex-col gap-5">
    <Link
      href="/training"
      className="inline-flex w-fit items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
    >
      <ArrowLeft size={15} />
      Training
    </Link>

    <PageHeader
      title="Certification"
      description="Verifying is the only thing that unlocks a capability. Standing is worked out from today's date, not from the stored status."
    />

    <AsyncSection reloadKey="certifications">
      <Board />
    </AsyncSection>
  </div>
);

export default CertificationsPage;
