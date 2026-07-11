"use server";

import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  createBoqFromCart,
  removeCartItem,
  updateCartItemQuantity,
} from "services";

export const updateQuantity = async (cartItemUuid: string, quantity: number) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  await updateCartItemQuantity({ userUuid: user.uuid, cartItemUuid, quantity });
};

export const removeItem = async (cartItemUuid: string) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  await removeCartItem({ userUuid: user.uuid, cartItemUuid });
};

// Checkout turns one solution in the cart into a draft BOQ. The category comes
// from a hidden field on the solution's checkout form. The draft lands in the
// admin dashboard, where an admin assigns a pre-seller to edit and submit it.
export const checkout = async (formData: FormData) => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const categoryUuid = formData.get("categoryUuid");
  if (typeof categoryUuid !== "string" || categoryUuid.length === 0) {
    throw new Error("Missing solution to check out");
  }

  const boq = await createBoqFromCart(user.uuid, categoryUuid);
  redirect(`/boq/${boq.uuid}`);
};
