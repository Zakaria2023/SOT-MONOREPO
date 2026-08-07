import { ImportBatchList } from "@/components/imports/import-batch-list";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";

const ImportsPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Imports"
      description="Nothing reaches the catalogue without passing through here."
      action={{ href: "/imports/new", label: "New Import" }}
    />

    <AsyncSection reloadKey="import-batches">
      <ImportBatchList />
    </AsyncSection>
  </div>
);

export default ImportsPage;
