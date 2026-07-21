import { ClassificationsTable } from "@/components/classifications/classifications-table";
import { AsyncSection } from "@/components/shared/async-section";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getClassifications } from "./action";

const ClassificationsList = async () => {
  const classifications = await getClassifications();
  return <ClassificationsTable classifications={classifications} />;
};

const ClassificationsPage = () => (
  <div className="flex flex-col gap-5">
    <div className="flex items-center justify-between">
      <h1 className="font-heading text-2xl text-ink">Classifications</h1>

      <Link
        href="/classifications/new"
        className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
      >
        <Plus size={16} />
        Add Classification
      </Link>
    </div>

    <AsyncSection reloadKey="classifications">
      <ClassificationsList />
    </AsyncSection>
  </div>
);

export default ClassificationsPage;
