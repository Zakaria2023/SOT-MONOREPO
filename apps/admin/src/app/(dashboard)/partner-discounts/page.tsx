import { PartnerDiscountsForm } from "@/components/partner-discounts/partner-discounts-form";
import { getPartnerDiscounts } from "./action";

const PartnerDiscountsPage = async () => {
  const discounts = await getPartnerDiscounts();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl text-ink">Partner Discounts</h1>
        <p className="mt-1 text-sm text-muted">
          Set the discount each partner capability earns off MSRP. Partners see
          the stacked discount when they shop.
        </p>
      </div>

      <PartnerDiscountsForm defaults={discounts} />
    </div>
  );
};

export default PartnerDiscountsPage;
