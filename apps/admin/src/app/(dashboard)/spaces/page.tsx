import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";
import { SpacesBoard } from "@/components/spaces/spaces-board";

const SpacesPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Sites"
      description="What is installed where, and which firmware versions are still only somebody's word."
    />

    <AsyncSection reloadKey="spaces">
      <SpacesBoard />
    </AsyncSection>
  </div>
);

export default SpacesPage;
