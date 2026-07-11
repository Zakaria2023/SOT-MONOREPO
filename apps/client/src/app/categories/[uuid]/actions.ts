"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { addCategoryToCart } from "services";

export type AddSolutionResult = {
  error?: string;
};

export const addSolutionToCart = async (
  categoryUuid: string,
): Promise<AddSolutionResult> => {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in to add a solution to your cart." };
  }

  try {
    await addCategoryToCart(user.uuid, categoryUuid);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to add solution",
    };
  }

  revalidatePath("/");
  return {};
};
