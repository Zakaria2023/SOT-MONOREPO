import { SpecificationsTable } from "@/components/specifications/specifications-table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getSpecifications } from "services";

const SpecificationsPage = async () => {
  const specifications = await getSpecifications();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-ink">Specifications</h1>

        <Link
          href="/specifications/new"
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add Specification
        </Link>
      </div>

      <SpecificationsTable specifications={specifications} />
    </div>
  );
};

export default SpecificationsPage;
