"use client";

import { addProductToCart } from "@/app/actions";
import { Check, ShoppingCart } from "lucide-react";
import { useState, useTransition } from "react";

type AddToCartButtonProps = {
  productUuid: string;
};

export const AddToCartButton = ({ productUuid }: AddToCartButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const onClick = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await addProductToCart(productUuid);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-label="Add to cart"
      title={error}
      className="font-grotesk relative z-20 inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60 cursor-pointer"
    >
      {added ? <Check size={16} /> : <ShoppingCart size={16} />}
      {added ? "Added" : isPending ? "Adding…" : "Add"}
    </button>
  );
};
