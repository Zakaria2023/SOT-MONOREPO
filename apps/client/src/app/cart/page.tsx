import { CartView } from "@/components/cart/cart-view";
import { getCurrentUser } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCart, isProfileComplete } from "services";

export const metadata: Metadata = {
  title: "Your cart · Stratum",
};

const CartPage = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const items = await getCart(user.uuid);

  return <CartView items={items} needsProfile={!isProfileComplete(user)} />;
};

export default CartPage;
