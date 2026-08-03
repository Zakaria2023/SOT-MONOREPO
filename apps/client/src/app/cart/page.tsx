import { CartView } from "@/components/cart/cart-view";
import { GuestCartView } from "@/components/cart/guest-cart-view";
import { getCurrentUser } from "@/lib/auth";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { getCart, isProfileComplete } from "services";

export const metadata: Metadata = pageMetadata({
  title: "Your cart",
  description: "Review the hardware in your cart before checking out.",
  path: "/cart",
  noIndex: true,
});

const CartPage = async () => {
  const user = await getCurrentUser();
  // Guests shop with a local cart; it merges into the server cart on sign-in.
  if (!user) {
    return <GuestCartView />;
  }

  const [items, viewerPricing] = await Promise.all([
    getCart(user.uuid),
    getViewerPartnerPricing(),
  ]);

  return (
    <CartView
      items={items}
      needsProfile={!isProfileComplete(user)}
      discountPercent={viewerPricing.discountPercent}
    />
  );
};

export default CartPage;
