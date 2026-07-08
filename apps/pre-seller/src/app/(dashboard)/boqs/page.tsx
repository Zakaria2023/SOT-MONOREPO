import { BoqsTable } from "@/components/boqs/boqs-table";
import { requirePreSeller } from "@/lib/server/auth";
import { getAssignedBoqs } from "services";

const BoqsPage = async () => {
  const user = await requirePreSeller();
  const boqs = await getAssignedBoqs(user.id);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl text-ink">Assigned BOQs</h1>
      </div>

      <BoqsTable boqs={boqs} />
    </div>
  );
};

export default BoqsPage;
