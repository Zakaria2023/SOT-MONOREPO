"use server";

import type { UserType } from "@/db/enum";
import { adminListPage } from "@/lib/server/list";
import { requireAdmin } from "@/lib/server/auth";
import {
  getAdminUserDetail,
  getAuditTrail,
  listUsersPage,
  type AdminUserDetail,
  type AdminUserRow,
  type SelectCatalogAudit,
} from "services";
import type { ListParams, PaginatedResult } from "utils";

// The list read goes through adminListPage, which is where the auth check lives
// for every other list in this app — the page itself only lays out.

export const getUsersPage = async (
  params: ListParams & { type?: UserType } = {},
): Promise<PaginatedResult<AdminUserRow>> =>
  adminListPage(params, ({ search, limit, offset }) =>
    listUsersPage({ search, limit, offset, type: params.type }),
  );

export const getUserDetailAction = async (
  uuid: string,
): Promise<AdminUserDetail | null> => {
  await requireAdmin();
  return getAdminUserDetail(uuid);
};

/**
 * What has been done TO this account, as opposed to by it.
 *
 * A separate read from the event timeline on purpose. The timeline is the
 * person's own history — orders, BOQs, questions — and this is the record of
 * staff acting on their record. Merging them would make "who changed this" and
 * "what did they do" the same list, and only one of those is an accountability
 * question.
 */
export const getUserAuditAction = async (
  uuid: string,
): Promise<SelectCatalogAudit[]> => {
  await requireAdmin();
  return getAuditTrail(uuid);
};
