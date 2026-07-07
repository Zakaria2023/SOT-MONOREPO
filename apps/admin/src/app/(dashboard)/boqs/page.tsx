import { BoqsTable } from "@/components/boqs/boqs-table";
import { requireAdmin } from "@/lib/server/auth";
import { getAllBoqs } from "services";
import { listPreSellers } from "./action";

const BoqsPage = async () => {
  await requireAdmin();
  const [boqs, preSellers] = await Promise.all([getAllBoqs(), listPreSellers()]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col">
        <h1 className="font-heading text-2xl text-ink">BOQs</h1>
        <p className="text-sm text-muted">
          Every customer BOQ and the pre-seller it&apos;s assigned to.
        </p>
      </div>

      <BoqsTable boqs={boqs} preSellers={preSellers} />
    </div>
  );
};

export default BoqsPage;
