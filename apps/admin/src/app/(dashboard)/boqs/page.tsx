import { BoqsTable } from "@/components/boqs/boqs-table";
import { requireAdmin } from "@/lib/server/auth";
import { getAllBoqs } from "services";
import { listPreSellers } from "./action";

const BoqsPage = async () => {
  await requireAdmin();
  const [boqs, preSellers] = await Promise.all([
    getAllBoqs(),
    listPreSellers(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl text-ink">BOQs</h1>

      <BoqsTable boqs={boqs} preSellers={preSellers} />
    </div>
  );
};

export default BoqsPage;
