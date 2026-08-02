import { OffersList } from "@/components/offers/offers-list";
import { AsyncSection } from "@/components/shared/async-section";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const OffersPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Offers"
        description="Review partner offers and approve them so the customer can choose."
      />

      <ListSearch placeholder="Search by BOQ reference or customer..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <OffersList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default OffersPage;
