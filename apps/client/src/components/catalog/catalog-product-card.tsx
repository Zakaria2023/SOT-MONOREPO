"use client";

import { addProductToCart } from "@/app/cart/actions";
import { ProductPrice } from "@/components/shared/product-price";
import { documentImageUrl } from "@/lib/documents";
import { addToGuestCart } from "@/lib/guest-cart";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { Check, ImageOff, PackageX, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { ProductListItem } from "services";

type CatalogProductCardProps = {
  product: ProductListItem;
  view: "grid" | "list";
  // The signed-in partner's stacked discount (0 = MSRP for guests/clients).
  discountPercent?: number;
  /**
   * Set on the cards that start above the fold. It preloads the thumbnail rather
   * than lazy-loading it, which is what lets one of these be the LCP instead of
   * something the browser only discovers after layout. Leave it off further down
   * the grid — priority on everything is the same as priority on nothing.
   */
  priority?: boolean;
};

type ThumbProps = {
  product: ProductListItem;
  className: string;
  iconSize: number;
  priority: boolean;
};

type MetaProps = {
  product: ProductListItem;
};

type AddButtonProps = {
  product: ProductListItem;
};

const Thumb = ({ product, className, iconSize, priority }: ThumbProps) => (
  <div
    className={cn(
      "relative flex items-center justify-center overflow-hidden bg-surface-2",
      className,
    )}
  >
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,110,255,0.14),rgba(255,255,255,0.02)_70%)]"
    />
    {product.image ? (
      <Image
        src={documentImageUrl(product.image)}
        alt={product.name}
        fill
        sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
        priority={priority}
        className="object-contain p-4"
      />
    ) : (
      <ImageOff size={iconSize} className="relative text-faint" />
    )}
  </div>
);

const Meta = ({ product }: MetaProps) => (
  <div className="flex items-center gap-2">
    {product.brandName && (
      <span className="font-grotesk text-xs font-bold tracking-wide text-primary uppercase">
        {product.brandName}
      </span>
    )}
    {product.brandName && product.categoryName && (
      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-faint" />
    )}
    {product.categoryName && (
      <span className="font-grotesk text-xs text-faint">
        {product.categoryName}
      </span>
    )}
  </div>
);

const AddButton = ({ product }: AddButtonProps) => {
  const { isSignedIn, isLoaded } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  if (!product.isAvailable) {
    return (
      <span className="font-grotesk relative z-20 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-faint">
        <PackageX size={16} /> Unavailable
      </span>
    );
  }

  const flashAdded = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const onClick = () => {
    // Guests add to their local cart; it merges into the server cart on sign-in.
    if (!isSignedIn) {
      addToGuestCart(product.uuid);
      flashAdded();
      return;
    }
    startTransition(async () => {
      const result = await addProductToCart(product.uuid);
      if (result.error) {
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
      aria-label={`Add ${product.name} to cart`}
      className="bg-accent-gradient font-grotesk relative z-20 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-[#07101F] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {added ? <Check size={16} /> : <ShoppingCart size={16} />}
      {added ? "Added" : isPending ? "Adding…" : "Add"}
    </button>
  );
};

export const CatalogProductCard = ({
  product,
  view,
  discountPercent = 0,
  priority = false,
}: CatalogProductCardProps) => {
  const price = (
    <ProductPrice
      price={product.price}
      currency={product.currency}
      discountPercent={discountPercent}
      className="font-grotesk text-lg font-bold text-ink"
    />
  );

  if (view === "list") {
    return (
      <article className="group relative flex items-center gap-4 rounded-2xl border border-hairline bg-surface p-4 shadow-sm transition-colors hover:border-primary/40">
        <Link
          href={`/products/${product.slug}`}
          aria-label={`View ${product.name}`}
          className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
        />
        <Thumb
          product={product}
          className="h-24 w-24 shrink-0 rounded-xl"
          iconSize={28}
          priority={priority}
        />
        <div className="min-w-0 flex-1">
          <Meta product={product} />
          <h3 className="font-heading mt-1 text-lg leading-snug font-bold text-ink">
            {product.name}
          </h3>
          {product.description && (
            <p className="font-grotesk mt-1 line-clamp-1 text-sm text-muted">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 pl-2">
          {price}
          <AddButton product={product} />
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <Link
        href={`/products/${product.slug}`}
        aria-label={`View ${product.name}`}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
      />
      <Thumb
        product={product}
        className="h-44"
        iconSize={36}
        priority={priority}
      />
      <div className="flex flex-1 flex-col p-5">
        <Meta product={product} />
        <h3 className="font-heading mt-2 text-lg leading-snug font-bold text-ink">
          {product.name}
        </h3>
        {product.description && (
          <p className="font-grotesk mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
            {product.description}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between pt-1">
          {price}
          <AddButton product={product} />
        </div>
      </div>
    </article>
  );
};
