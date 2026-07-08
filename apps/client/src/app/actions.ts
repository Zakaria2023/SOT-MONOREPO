"use server";

import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addToCart, logoutUser } from "services";

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

/** Revokes the current session and clears the auth cookies, then goes home. */
export const signOut = async (): Promise<void> => {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (refreshToken) {
    try {
      await logoutUser(refreshToken);
    } catch {
      // Session may already be gone — clear the cookies regardless.
    }
  }

  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");

  redirect("/");
};
