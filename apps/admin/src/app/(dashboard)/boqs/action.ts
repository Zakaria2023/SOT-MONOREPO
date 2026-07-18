"use server";

import { requireAdmin } from "@/lib/server/auth";
import { getClerkPreSellerUsers } from "@/lib/server/clerk";
import { revalidatePath } from "next/cache";
import { assignBoq, getAllBoqs, type BoqListItem } from "services";
import type { PaginatedResult } from "utils";
import { buildPaginatedResult, resolvePagination } from "utils";

export type PreSellerOption = {
  id: string;
  name: string;
};

export type AssignResult = {
  error?: string;
};

export type BoqListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

// Searched + paginated page of BOQs for the list table. The frontend drives
// `search`/`page` through URL search params.
export const getBoqsPage = async (
  params: BoqListParams = {},
): Promise<PaginatedResult<BoqListItem>> => {
  await requireAdmin();
  const { page, pageSize, offset } = resolvePagination(
    params.page,
    params.pageSize,
  );
  const { items, total } = await getAllBoqs({
    search: params.search,
    limit: pageSize,
    offset,
  });
  return buildPaginatedResult(items, total, page, pageSize);
};

/** Clerk users whose publicMetadata role is "pre-seller". */
export const listPreSellers = async (): Promise<PreSellerOption[]> => {
  await requireAdmin();
  const users = await getClerkPreSellerUsers();
  return users.map((user) => ({ id: user.id, name: user.label }));
};

/**
 * Assigns a pre-seller to a draft BOQ, or clears the assignment when
 * `preSellerId` is empty. The assigned pre-seller then sees the draft in
 * their queue to edit and submit.
 */
export const assignBoqAction = async (
  boqUuid: string,
  preSellerId: string,
): Promise<AssignResult> => {
  await requireAdmin();

  try {
    if (!preSellerId) {
      await assignBoq(boqUuid, null);
    } else {
      const preSellers = await getClerkPreSellerUsers();
      const preSeller = preSellers.find((user) => user.id === preSellerId);
      if (!preSeller) {
        throw new Error("Selected user does not have the pre-seller role");
      }
      await assignBoq(boqUuid, { id: preSeller.id, name: preSeller.label });
    }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to assign pre-seller",
    };
  }

  revalidatePath("/boqs");
  return {};
};
