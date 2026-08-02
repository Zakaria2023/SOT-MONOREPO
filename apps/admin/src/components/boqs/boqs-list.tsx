import { getBoqsPage, listPreSellers } from "@/app/(dashboard)/boqs/action";
import { BoqsTable } from "@/components/boqs/boqs-table";
import { Pagination } from "@/components/shared/pagination";

type BoqsListProps = {
  // Straight off the URL, so both arrive as text or not at all; getBoqsPage
  // decides what a missing or unparseable page means.
  search?: string;
  page?: string;
};

// The part of the BOQs screen that waits on data — everything the page's
// AsyncSection suspends around. The two reads are independent, so they go out
// together rather than one after the other.
export const BoqsList = async ({ search, page }: BoqsListProps) => {
  const [result, preSellers] = await Promise.all([
    getBoqsPage({ search, page }),
    listPreSellers(),
  ]);

  return (
    <>
      <BoqsTable boqs={result.items} preSellers={preSellers} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};
