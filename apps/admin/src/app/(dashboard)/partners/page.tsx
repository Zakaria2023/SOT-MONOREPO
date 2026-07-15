import { PartnerRequestsTable } from "@/components/partners/partner-requests-table";
import { requireAdmin } from "@/lib/server/auth";
import { getPartnerRequests } from "./action";

const PartnersPage = async () => {
  await requireAdmin();
  const requests = await getPartnerRequests();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Partners</h1>
        <p className="text-sm text-muted">
          Review public partner applications and approve or reject them.
        </p>
      </div>

      <PartnerRequestsTable requests={requests} />
    </div>
  );
};

export default PartnersPage;
