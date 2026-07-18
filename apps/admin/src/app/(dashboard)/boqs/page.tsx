import { BoqsTable } from "@/components/boqs/boqs-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { requireAdmin } from "@/lib/server/auth";
import { getBoqsPage, listPreSellers } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const BoqsPage = async ({ searchParams }: Props) => {
  await requireAdmin();
  const { search, page } = await searchParams;
  const [result, preSellers] = await Promise.all([
    getBoqsPage({ search, page }),
    listPreSellers(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl text-ink">BOQs</h1>

      <ListSearch placeholder="Search by reference or customer..." />

      <BoqsTable boqs={result.items} preSellers={preSellers} />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </div>
  );
};

export default BoqsPage;
