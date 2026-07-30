"use server";

import { requireAdmin } from "@/lib/server/auth";
import { getAuditFeed } from "services";
import type {
  AuditFilters as ServiceAuditFilters,
  SelectCatalogAudit as ServiceSelectCatalogAudit,
} from "services";

// Types re-declared as local aliases — a "use server" file may only export
// async functions.
export type AuditFilters = ServiceAuditFilters;
export type CatalogAuditEntry = ServiceSelectCatalogAudit;

export const getActivity = async (
  filters: AuditFilters = {},
): Promise<CatalogAuditEntry[]> => {
  await requireAdmin();
  return getAuditFeed(filters);
};
