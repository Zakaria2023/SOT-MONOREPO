"use server";

import { getCurrentUser } from "@/lib/auth";
import { removeCartItem, updateCartItemQuantity } from "services";

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
