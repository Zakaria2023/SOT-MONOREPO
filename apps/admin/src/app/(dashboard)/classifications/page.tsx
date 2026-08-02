import { ClassificationsList } from "@/components/classifications/classifications-list";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";

const ClassificationsPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Classifications"
      action={{ href: "/classifications/new", label: "Add Classification" }}
    />

    <AsyncSection reloadKey="classifications">
      <ClassificationsList />
    </AsyncSection>
  </div>
);

export default ClassificationsPage;
