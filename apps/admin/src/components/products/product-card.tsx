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
    <article className="relative flex flex-col overflow-hidden rounded-panel border border-hairline bg-surface transition-colors hover:border-primary/40">
      <div className="relative flex h-40 items-center justify-center border-b border-hairline bg-hover">
        {product.image ? (
          <Image
            src={documentImageUrl(product.image)}
            alt={product.name}
            fill
            sizes="320px"
            className="object-contain p-4"
          />
        ) : (
          <ImageOff size={26} className="text-faint" />
        )}

        <span
          className={`absolute top-3 left-3 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[status]}`}
        >
          {PRODUCT_STATUS_LABELS[status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-semibold text-ink">
              {product.name}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {product.categoryName ?? "No category"}
              {product.brandName ? ` · ${product.brandName}` : ""}
            </p>
          </div>
          {/* Above the stretched link below, or the card would swallow the menu. */}
          <div className="relative z-10 shrink-0">
            <ProductRowActions uuid={product.uuid} name={product.name} />
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-hairline pt-3">
          <span className="font-semibold text-ink">
            {product.price ? (
              formatPrice(product.price, product.currency)
            ) : (
              <span className="text-sm font-normal text-faint">
                Set by partner
              </span>
            )}
          </span>
          <span className="text-xs text-faint">Order {product.order}</span>
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
