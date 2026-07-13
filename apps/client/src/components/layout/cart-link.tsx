"use client";

import { guestCartCount, useGuestCart } from "@/lib/guest-cart";
import { useAuth } from "@clerk/nextjs";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

type CartLinkProps = {
  serverCount: number;
};

// Cart icon + badge for both guests and signed-in users. Signed-in uses the
// server cart count; guests use their local (browser) cart.
export const CartLink = ({ serverCount }: CartLinkProps) => {
  const { isSignedIn } = useAuth();
  const guestItems = useGuestCart();
  const count = isSignedIn ? serverCount : guestCartCount(guestItems);

  return (
    <Link
      href="/cart"
      aria-label="Cart"
      className="relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-search-border text-secondary transition-colors hover:text-primary"
    >
      <ShoppingCart size={18} />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-grotesk text-xs font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
};
