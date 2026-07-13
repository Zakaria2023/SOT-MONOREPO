import { CartView } from "@/components/cart/cart-view";
import { GuestCartView } from "@/components/cart/guest-cart-view";
import { getCurrentUser } from "@/lib/auth";
import type { Metadata } from "next";
import { getCart, isProfileComplete } from "services";

export const metadata: Metadata = {
  title: "Your cart · Stratum",
};

const CartPage = async () => {
  const user = await getCurrentUser();
  // Guests shop with a local cart; it merges into the server cart on sign-in.
  if (!user) {
    return <GuestCartView />;
  }

  const items = await getCart(user.uuid);

  return <CartView items={items} needsProfile={!isProfileComplete(user)} />;
};

export default CartPage;
