import { OrdersTable } from "@/components/orders/orders-table";
import { AsyncSection } from "@/components/shared/async-section";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const OrdersPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Orders"
        description="Cash is recorded here. Nothing settles an order by itself."
      />

      {/* Searchable by payment reference too, so somebody holding a receipt can
          find the order it belongs to rather than the other way round. */}
      <ListSearch placeholder="Search by order reference, customer or receipt..." />

      <AsyncSection reloadKey={`${search}-${page}`}>
        <OrdersTable search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default OrdersPage;
