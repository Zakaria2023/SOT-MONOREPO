"use client";

import { mergeGuestCart } from "@/app/cart/actions";
import { clearGuestCart, readGuestCartOnce } from "@/lib/guest-cart";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// Rendered only when signed in (see navbar). On mount it moves any items the
// user added as a guest into their server cart, then clears the local cart.
export const GuestCartSync = () => {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const merged = useRef(false);

  useEffect(() => {
    if (!isSignedIn || merged.current) {
      return;
    }
    const items = readGuestCartOnce();
    if (items.length === 0) {
      return;
    }

    merged.current = true;
    void (async () => {
      await mergeGuestCart(items);
      clearGuestCart();
      router.refresh();
    })();
  }, [isSignedIn, router]);

  return null;
};
