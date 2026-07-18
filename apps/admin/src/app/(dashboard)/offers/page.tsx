import { OffersTable } from "@/components/offers/offers-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { requireAdmin } from "@/lib/server/auth";
import { AsyncSection } from "@/components/shared/async-section";
import { getOffersPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

type OffersListProps = {
  search?: string;
  page?: string;
};

const OffersList = async ({ search, page }: OffersListProps) => {
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

const OffersPage = async ({ searchParams }: Props) => {
  await requireAdmin();
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Offers</h1>
        <p className="text-sm text-muted">
          Review partner offers and approve them so the customer can choose.
        </p>
      </div>

      <ListSearch placeholder="Search by BOQ reference or customer..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <OffersList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default OffersPage;
