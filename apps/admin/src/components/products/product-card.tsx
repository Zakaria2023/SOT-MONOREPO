"use client";

import { ProductRowActions } from "@/components/products/product-row-actions";
import type { ProductStatus } from "@/db/enum";
import { PRODUCT_STATUS_LABELS } from "@/db/label";
import { documentImageUrl } from "@/lib/documents";
import { ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "services";
import { formatPrice } from "utils";

type ProductCardProps = {
  product: ProductListItem;
};

const STATUS_BADGE_CLASSES: Record<ProductStatus, string> = {
  in_stock: "bg-success-tint text-success",
  out_of_stock: "bg-danger-tint text-danger",
  limited_stock: "bg-warning-tint text-warning",
  pre_order: "bg-primary-tint text-primary",
  in_order: "bg-primary-tint text-primary",
  end_of_sale: "bg-hover text-faint",
  end_of_life: "bg-hover text-faint",
};

/**
 * One product as a card: the same eight fields the table column set carried —
 * image, name, category, brand, price, status, order, actions — with the picture
 * given room to be looked at rather than shrunk to a 40px cell.
 *
 * The actions sit above the stretched link rather than inside it: a menu nested in
 * a link is neither, and on a card the whole surface is the link.
 */
export const ProductCard = ({ product }: ProductCardProps) => {
  const status = product.status ?? "in_stock";

  return (
    <article className="group relative flex flex-col gap-4 rounded-card border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(27,35,51,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_28px_-12px_rgba(27,35,51,0.18)]">
      {/* The picture sits in its own rounded well inside the card, not edge to
          edge against a hard divider. A photographed switch on a white product
          shot needs a soft field behind it or the card reads as two rectangles
          stacked. */}
      <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-control bg-hover">
        {product.image ? (
          <Image
            src={documentImageUrl(product.image)}
            alt={product.name}
            fill
            sizes="320px"
            className="object-contain p-5 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <ImageOff size={26} className="text-faint" />
        )}

        <span
          className={`absolute top-2.5 left-2.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[status]}`}
        >
          {PRODUCT_STATUS_LABELS[status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 leading-snug font-semibold text-ink">
              {product.name}
            </h3>
            <p className="mt-1.5 line-clamp-1 text-sm text-muted">
              {product.categoryName ?? "No category"}
              {product.brandName ? ` · ${product.brandName}` : ""}
            </p>
          </div>
          {/* Above the stretched link below, or the card would swallow the menu.
              Revealed on hover so three outlined buttons are not the loudest
              thing in a grid of twelve cards — always present for keyboards. */}
          <div className="relative z-10 shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <ProductRowActions uuid={product.uuid} name={product.name} />
          </div>
        </div>

        {/* Price only. The sort key was a column in the table because a table
            shows what it has; on a card it was a number with no meaning to anyone
            reading the grid. */}
        <div className="mt-auto border-t border-hairline-soft pt-3">
          <span className="font-semibold text-ink">
            {product.price ? (
              formatPrice(product.price, product.currency)
            ) : (
              <span className="text-sm font-normal text-faint">
                Set by partner
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Stretched link: the card is one target, and the actions above opt out. */}
      <Link
        href={`/products/${product.uuid}`}
        aria-label={`Open ${product.name}`}
        className="absolute inset-0"
      />
    </article>
  );
};
