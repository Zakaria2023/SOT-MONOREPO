import { GovernmentRequestsTable } from "@/components/government/government-requests-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { requireAdmin } from "@/lib/server/auth";
import { getGovernmentRequestsPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const GovernmentPage = async ({ searchParams }: Props) => {
  await requireAdmin();
  const { search, page } = await searchParams;
  const result = await getGovernmentRequestsPage({ search, page });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Government</h1>
        <p className="text-sm text-muted">
          Review government access requests and invite approved entities.
        </p>
      </div>

      <ListSearch placeholder="Search by entity, name, or email..." />

      <GovernmentRequestsTable requests={result.items} />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </div>
  );
};

export default GovernmentPage;
