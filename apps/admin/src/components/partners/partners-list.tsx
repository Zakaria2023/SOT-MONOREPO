import { getPartnerRequestsPage } from "@/app/(dashboard)/partners/action";
import { PartnerRequestsTable } from "@/components/partners/partner-requests-table";
import { Pagination } from "@/components/shared/pagination";

type PartnersListProps = {
  // Straight off the URL, so both arrive as text or not at all;
  // getPartnerRequestsPage decides what a missing or unparseable page means.
  search?: string;
  page?: string;
};

// The part of the partners screen that waits on data — what the page's
// AsyncSection suspends around.
export const PartnersList = async ({ search, page }: PartnersListProps) => {
  const result = await getPartnerRequestsPage({ search, page });

  return (
    <>
      <PartnerRequestsTable requests={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};
