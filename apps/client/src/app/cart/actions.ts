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

// Checkout turns the cart into a draft BOQ, then opens it for review.
export const checkout = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const boq = await createBoqFromCart(user.uuid);
  redirect(`/boq/${boq.uuid}`);
};
