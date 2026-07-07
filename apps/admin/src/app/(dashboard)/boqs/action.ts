"use server";

import { requireAdmin } from "@/lib/server/auth";
import { getClerkPreSellerUsers } from "@/lib/server/clerk";
import { revalidatePath } from "next/cache";
import { assignBoq } from "services";

export type PreSellerOption = {
  id: string;
  name: string;
};

export type AssignResult = {
  error?: string;
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
