import { SpecificationsTable } from "@/components/specifications/specifications-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { Plus } from "lucide-react";
import Link from "next/link";
import { AsyncSection } from "@/components/shared/async-section";
import { getSpecificationsPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

type SpecificationsListProps = {
  search?: string;
  page?: string;
};

const SpecificationsList = async ({ search, page }: SpecificationsListProps) => {
  const result = await getSpecificationsPage({ search, page });
  return (
    <>
      <SpecificationsTable specifications={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};

const SpecificationsPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;

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

      <ListSearch placeholder="Search specifications..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <SpecificationsList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default SpecificationsPage;
