import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { getDashboardStats } from "./action";

const HomePage = async () => {
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          A live snapshot of everything in the store.
        </p>
      </div>

      <DashboardStats stats={stats} />
    </div>
  );
};

export default HomePage;
