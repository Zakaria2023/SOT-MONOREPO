import { GovernmentRequestsTable } from "@/components/government/government-requests-table";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { requireAdmin } from "@/lib/server/auth";
import { AsyncSection } from "@/components/shared/async-section";
import { getGovernmentRequestsPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

type GovernmentListProps = {
  search?: string;
  page?: string;
};

const GovernmentList = async ({ search, page }: GovernmentListProps) => {
  const result = await getGovernmentRequestsPage({ search, page });
  return (
    <>
      <GovernmentRequestsTable requests={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};

const GovernmentPage = async ({ searchParams }: Props) => {
  await requireAdmin();
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Government"
        description="Review government access requests and invite approved entities."
      />

      <ListSearch placeholder="Search by entity, name, or email..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <GovernmentList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default GovernmentPage;
