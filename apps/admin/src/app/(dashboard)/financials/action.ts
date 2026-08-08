"use server";

import { requireAdmin } from "@/lib/server/auth";
import { getPlatformFinancials, type PlatformSummary } from "services";

// A11. Revenue, what delivery cost in partner payables, and the margin between.
//
// Its own route and its own action deliberately. The payables screen has no path
// to any of this — not a hidden column, not a role flag inside a shared query,
// which is one careless `if` away from showing a finance clerk the margin.

export const getPlatformFinancialsAction =
  async (): Promise<PlatformSummary> => {
    await requireAdmin();
    return getPlatformFinancials();
  };
