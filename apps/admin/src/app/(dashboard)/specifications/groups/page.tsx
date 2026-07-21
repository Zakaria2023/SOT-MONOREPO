import { GroupsManager } from "@/components/specifications/groups-manager";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getSpecificationGroups } from "services";

const SpecificationGroupsPage = async () => {
  const groups = await getSpecificationGroups();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/specifications"
          className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline"
        >
          <ArrowLeft size={15} />
          Back to library
        </Link>
        <h1 className="font-heading mt-2 text-2xl text-ink">
          Specification groups
        </h1>
        <p className="mt-1 text-sm text-muted">
          Group attributes by function and file each group under a navigation
          domain. Reorder to control how the library reads.
        </p>
      </div>

      <GroupsManager groups={groups} />
    </div>
  );
};

export default SpecificationGroupsPage;
