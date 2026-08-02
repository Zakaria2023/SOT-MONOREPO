import { ClassificationsTable } from "@/components/classifications/classifications-table";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";
import { getClassifications } from "./action";

const ClassificationsList = async () => {
  const classifications = await getClassifications();
  return <ClassificationsTable classifications={classifications} />;
};

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
