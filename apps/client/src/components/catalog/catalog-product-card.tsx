"use client";

import { documentDownloadUrl } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { Check, ImageOff, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "services";
import { formatPrice } from "utils";

type CatalogProductCardProps = {
  product: ProductListItem;
  adding: boolean;
  view: "grid" | "list";
  onAdd: () => void;
};

type ThumbProps = {
  product: ProductListItem;
  className: string;
  iconSize: number;
};

type MetaProps = {
  product: ProductListItem;
};

type AddButtonProps = {
  productName: string;
  adding: boolean;
  onAdd: () => void;
};

const Thumb = ({ product, className, iconSize }: ThumbProps) => (
  <div
    className={cn(
      "relative flex items-center justify-center overflow-hidden bg-[#F5F3FC]",
      className,
    )}
  >
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.16),transparent_65%)]"
    />
    {product.image ? (
      <Image
        src={documentDownloadUrl(product.image)}
        alt={product.name}
        fill
        unoptimized
        className="object-contain p-4"
      />
    ) : (
      <ImageOff size={iconSize} className="relative text-[#B7B3C4]" />
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
      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#8A8F98]" />
    )}
    {product.categoryName && (
      <span className="font-grotesk text-xs text-[#8A8F98]">
        {product.categoryName}
      </span>
    )}
  </div>
);

const AddButton = ({ productName, adding, onAdd }: AddButtonProps) => (
  <button
    type="button"
    onClick={onAdd}
    disabled={adding}
    aria-label={`Add ${productName} to cart`}
    className="font-grotesk relative z-20 inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
  >
    {adding ? <Check size={16} /> : <ShoppingCart size={16} />}
    {adding ? "Added" : "Add"}
  </button>
);

export const CatalogProductCard = ({
  product,
  adding,
  view,
  onAdd,
}: CatalogProductCardProps) => {
  const price = (
    <span className="font-grotesk text-lg font-bold tabular-nums text-ink">
      {formatPrice(product.price, product.currency)}
    </span>
  );

  if (view === "list") {
    return (
      <article className="group relative flex items-center gap-4 rounded-2xl border border-hairline bg-white p-4 shadow-sm transition-colors hover:border-primary/40">
        <Link
          href={`/products/${product.slug}`}
          aria-label={`View ${product.name}`}
          className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
        />
        <Thumb
          product={product}
          className="h-24 w-24 shrink-0 rounded-xl"
          iconSize={28}
        />
        <div className="min-w-0 flex-1">
          <Meta product={product} />
          <h3 className="font-heading mt-1 text-lg leading-snug font-bold text-ink">
            {product.name}
          </h3>
          {product.description && (
            <p className="font-grotesk mt-1 line-clamp-1 text-sm text-[#62656B]">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 pl-2">
          {price}
          <AddButton productName={product.name} adding={adding} onAdd={onAdd} />
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <Link
        href={`/products/${product.slug}`}
        aria-label={`View ${product.name}`}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
      />
      <Thumb product={product} className="h-44" iconSize={36} />
      <div className="flex flex-1 flex-col p-5">
        <Meta product={product} />
        <h3 className="font-heading mt-2 text-lg leading-snug font-bold text-ink">
          {product.name}
        </h3>
        {product.description && (
          <p className="font-grotesk mt-2 line-clamp-2 text-sm leading-relaxed text-[#62656B]">
            {product.description}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between pt-1">
          {price}
          <AddButton productName={product.name} adding={adding} onAdd={onAdd} />
        </div>
      </div>
    </article>
  );
};
