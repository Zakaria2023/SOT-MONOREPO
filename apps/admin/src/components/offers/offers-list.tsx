import { getOffersPage } from "@/app/(dashboard)/offers/action";
import { OffersTable } from "@/components/offers/offers-table";
import { Pagination } from "@/components/shared/pagination";

type OffersListProps = {
  // Straight off the URL, so both arrive as text or not at all; getOffersPage
  // decides what a missing or unparseable page means.
  search?: string;
  page?: string;
};

// The part of the offers screen that waits on data — what the page's
// AsyncSection suspends around.
export const OffersList = async ({ search, page }: OffersListProps) => {
  const result = await getOffersPage({ search, page });

  return (
    <>
      <OffersTable offers={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};
