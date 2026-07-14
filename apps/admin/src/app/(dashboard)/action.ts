"use server";

import { requireAdmin } from "@/lib/server/auth";
import { getAdminDashboardStats } from "services";
import type { AdminDashboardStats } from "services";

export const getDashboardStats = async (): Promise<AdminDashboardStats> => {
  await requireAdmin();
  return getAdminDashboardStats();
};
