"use server";

import { requireAdmin } from "@/lib/server/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { assignBoq } from "services";

export type PreSellerOption = {
  id: string;
  name: string;
};

export type AssignResult = {
  error?: string;
};

type ClerkUser = Awaited<
  ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>
>;

const displayName = (user: ClerkUser): string => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  if (fullName) return fullName;
  return user.emailAddresses[0]?.emailAddress ?? "Pre-seller";
};

/** Clerk users whose publicMetadata role is "pre-seller". */
export const listPreSellers = async (): Promise<PreSellerOption[]> => {
  await requireAdmin();
  const client = await clerkClient();
  const { data } = await client.users.getUserList({ limit: 100 });

  return data
    .filter((user) => user.publicMetadata?.role === "pre-seller")
    .map((user) => ({ id: user.id, name: displayName(user) }));
};

/** Assigns a pre-seller to a BOQ, or clears it when `preSellerId` is empty. */
export const assignBoqAction = async (
  boqUuid: string,
  preSellerId: string,
): Promise<AssignResult> => {
  await requireAdmin();

  try {
    if (!preSellerId) {
      await assignBoq(boqUuid, null);
    } else {
      const client = await clerkClient();
      const user = await client.users.getUser(preSellerId);
      await assignBoq(boqUuid, { id: user.id, name: displayName(user) });
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
