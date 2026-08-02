import { PartnerDiscountsForm } from "@/components/partner-discounts/partner-discounts-form";
import { PageHeader } from "@/components/shared/page-header";
import { getPartnerDiscounts } from "./action";

const PartnerDiscountsPage = async () => {
  const discounts = await getPartnerDiscounts();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Partner Discounts"
        description="Set the discount each partner capability earns off MSRP. Partners see the stacked discount when they shop."
      />

      <PartnerDiscountsForm defaults={discounts} />
    </div>
  );
};

export default PartnerDiscountsPage;
