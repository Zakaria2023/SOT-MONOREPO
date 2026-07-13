import { GovernmentRequestsTable } from "@/components/government/government-requests-table";
import { requireAdmin } from "@/lib/server/auth";
import { getGovernmentRequests } from "./action";

const GovernmentPage = async () => {
  await requireAdmin();
  const requests = await getGovernmentRequests();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Government</h1>
        <p className="text-sm text-muted">
          Review government access requests and invite approved entities.
        </p>
      </div>

      <GovernmentRequestsTable requests={requests} />
    </div>
  );
};

export default GovernmentPage;
