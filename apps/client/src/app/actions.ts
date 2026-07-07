"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { addToCart } from "services";

export type AddToCartResult = {
  error?: string;
};

export const addProductToCart = async (
  productUuid: string,
): Promise<AddToCartResult> => {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to add items to your cart." };

  try {
    await addToCart({ userUuid: user.uuid, productUuid });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to add to cart",
    };
  }

  revalidatePath("/");
  return {};
};
