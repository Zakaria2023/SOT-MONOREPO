import { getGovernmentRequestsPage } from "@/app/(dashboard)/government/action";
import { GovernmentRequestsTable } from "@/components/government/government-requests-table";
import { Pagination } from "@/components/shared/pagination";

type GovernmentListProps = {
  // Straight off the URL, so both arrive as text or not at all;
  // getGovernmentRequestsPage decides what a missing or unparseable page means.
  search?: string;
  page?: string;
};

// The part of the government screen that waits on data — what the page's
// AsyncSection suspends around.
export const GovernmentList = async ({ search, page }: GovernmentListProps) => {
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
