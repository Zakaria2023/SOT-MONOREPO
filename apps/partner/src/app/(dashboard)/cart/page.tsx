import { getPartnerCartAction } from "@/app/(dashboard)/cart/actions";
import { PartnerCart } from "@/components/cart/partner-cart";

const PartnerCartPage = async () => {
  const view = await getPartnerCartAction();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl">Your basket</h1>
        <p className="text-sm text-muted">
          The same basket can be bought as stock, sent to SOT to be built, or
          quoted for a client. What is open to you depends on what this account
          is approved to do.
        </p>
      </div>

      <PartnerCart view={view} />
    </div>
  );
};

export default PartnerCartPage;
