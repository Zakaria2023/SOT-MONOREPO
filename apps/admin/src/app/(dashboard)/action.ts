"use server";

import { requireAdmin } from "@/lib/server/auth";
import { AdminDashboardStats, getAdminDashboardStats } from "services";

export const getDashboardStats = async (): Promise<AdminDashboardStats> => {
  await requireAdmin();
  return getAdminDashboardStats();
};
