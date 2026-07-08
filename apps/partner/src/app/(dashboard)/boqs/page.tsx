import { BoqsTable } from "@/components/boqs/boqs-table";
import { requirePartner } from "@/lib/server/auth";
import { getPartnerBoqs } from "services";

const BoqsPage = async () => {
  const user = await requirePartner();
  const boqs = await getPartnerBoqs(user.id);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl text-ink">Incoming BOQs</h1>
        <p className="mt-1 text-sm text-muted">
          Bills of quantities a pre-seller has sent to you. Open one to send
          your offer.
        </p>
      </div>

      <BoqsTable boqs={boqs} />
    </div>
  );
};

export default BoqsPage;
