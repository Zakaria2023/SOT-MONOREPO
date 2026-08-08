import { PayablesBoard } from "@/components/payables/payables-board";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";

const PayablesPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Partner payables"
      description="What we owe, and what is waiting to be transferred."
    />

    <AsyncSection reloadKey="payables">
      <PayablesBoard />
    </AsyncSection>
  </div>
);

export default PayablesPage;
