import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { PageHeader } from "@/components/shared/page-header";
import { getDashboardStats } from "./action";

const HomePage = async () => {
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description="A live snapshot of everything in the store."
      />

      <DashboardStats stats={stats} />
    </div>
  );
};

export default HomePage;
