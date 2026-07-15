"use client";

import { addProductToCart } from "@/app/cart/actions";
import { addToGuestCart } from "@/lib/guest-cart";
import { useAuth } from "@clerk/nextjs";
import { Check, ShoppingCart } from "lucide-react";
import { useState, useTransition } from "react";

type AddToCartButtonProps = {
  productUuid: string;
};

export const AddToCartButton = ({ productUuid }: AddToCartButtonProps) => {
  const { isSignedIn, isLoaded } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const flashAdded = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const onClick = () => {
    setError(undefined);
    // Guests add to their local cart; it merges into the server cart on sign-in.
    if (!isSignedIn) {
      addToGuestCart(productUuid);
      flashAdded();
      return;
    }
    startTransition(async () => {
      const result = await addProductToCart(productUuid);
      if (result.error) {
        setError(result.error);
        return;
      }
      flashAdded();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending || !isLoaded}
      aria-label="Add to cart"
      title={error}
      className="font-grotesk relative z-20 inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60 cursor-pointer"
    >
      {added ? <Check size={16} /> : <ShoppingCart size={16} />}
      {added ? "Added" : isPending ? "Adding…" : "Add"}
    </button>
  );
};
