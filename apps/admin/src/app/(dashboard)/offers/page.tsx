import { OffersTable } from "@/components/offers/offers-table";
import { requireAdmin } from "@/lib/server/auth";
import { getOffers } from "./action";

const OffersPage = async () => {
  await requireAdmin();
  const offers = await getOffers();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Offers</h1>
        <p className="text-sm text-muted">
          Review partner offers and approve them so the customer can choose.
        </p>
      </div>

      <OffersTable offers={offers} />
    </div>
  );
};

export default OffersPage;
