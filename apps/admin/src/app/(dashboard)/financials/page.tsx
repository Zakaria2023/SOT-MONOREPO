import { FinancialsBoard } from "@/components/financials/financials-board";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";

const FinancialsPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Platform financials"
      description="What came in, what delivery cost, and what is left."
    />

    <AsyncSection reloadKey="financials">
      <FinancialsBoard />
    </AsyncSection>
  </div>
);

export default FinancialsPage;
