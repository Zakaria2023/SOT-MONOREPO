import { HandoverBoard } from "@/components/handovers/handover-board";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";

const HandoversPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Handovers"
      description="Where every installation has got to, and whose turn it is."
    />

    <AsyncSection reloadKey="handovers">
      <HandoverBoard />
    </AsyncSection>
  </div>
);

export default HandoversPage;
