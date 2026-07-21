import { LibraryView } from "@/components/specifications/library-view";
import { AsyncSection } from "@/components/shared/async-section";
import { Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { getSpecificationLibrary } from "services";

const SpecificationsLibrary = async () => {
  const domains = await getSpecificationLibrary();
  return <LibraryView domains={domains} />;
};

const SpecificationsPage = () => (
  <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl text-ink">Specification Library</h1>
        <p className="mt-1 text-sm text-muted">
          A brand-agnostic attribute catalog, organized by function. Define an
          attribute once, then add it to any product.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/specifications/groups"
          className="flex items-center gap-1.5 rounded-control border border-hairline px-4 py-2 text-sm font-semibold text-secondary hover:bg-hover"
        >
          <SlidersHorizontal size={16} />
          Manage groups
        </Link>
        <Link
          href="/specifications/new"
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add Attribute
        </Link>
      </div>
    </div>

    <AsyncSection reloadKey="specification-library">
      <SpecificationsLibrary />
    </AsyncSection>
  </div>
);

export default SpecificationsPage;
