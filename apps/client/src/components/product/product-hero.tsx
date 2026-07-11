import { AddToCartButton } from "@/components/home/add-to-cart-button";
import { documentDownloadUrl } from "@/lib/documents";
import { formatPrice } from "utils";
import {
  ArrowLeft,
  Cpu,
  Gauge,
  Layers,
  Network,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ProductDetail } from "services";

type ProductHeroProps = {
  product: ProductDetail;
  highlights: NonNullable<ProductDetail["highlights"]>;
  isAuthenticated: boolean;
};

const STAT_ICONS: LucideIcon[] = [Gauge, ShieldCheck, Users, Layers, Cpu, Network];

export const ProductHero = ({
  product,
  highlights,
  isAuthenticated,
}: ProductHeroProps) => {
  const chipHighlights = highlights.slice(0, 2);
  const statHighlights = highlights.slice(0, 4);
  const subImages = product.images ?? [];

  return (
    <section className="mx-auto max-w-7xl px-6 pt-8 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-control border border-hairline bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition-colors hover:border-primary hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to home
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <div className="relative flex h-105 items-center justify-center overflow-hidden rounded-card border border-hairline bg-linear-to-br from-primary-tint to-[#efe9fb]">
            {product.image ? (
              <Image
                src={documentDownloadUrl(product.image)}
                alt={product.name}
                fill
                unoptimized
                className="object-contain p-16"
              />
            ) : (
              <ShieldCheck size={96} className="text-primary/40" />
            )}

            {chipHighlights.length > 0 && (
              <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                {chipHighlights.map((highlight) => (
                  <span
                    key={highlight.k}
                    className="inline-flex items-center gap-2 rounded-control border border-hairline bg-surface/90 px-3 py-1.5 text-sm shadow-sm backdrop-blur"
                  >
                    <Gauge size={14} className="text-primary" />
                    <span className="font-semibold text-ink">{highlight.v}</span>
                    <span className="text-faint">{highlight.k}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {subImages.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {subImages.map((imageId) => (
                <div
                  key={imageId}
                  className="relative aspect-square overflow-hidden rounded-control border border-hairline bg-surface"
                >
                  <Image
                    src={documentDownloadUrl(imageId)}
                    alt={product.name}
                    fill
                    unoptimized
                    className="object-contain p-2"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {product.categoryName && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck size={13} /> {product.categoryName}
            </span>
          )}

          {product.brandName && (
            <p className="mt-4 font-grotesk text-xs font-bold uppercase tracking-wide text-faint">
              By {product.brandName}
            </p>
          )}

          <h1 className="mt-1 font-heading text-4xl leading-tight text-ink">
            {product.name}
          </h1>

          {product.description && (
            <p className="mt-4 text-base leading-relaxed text-muted">
              {product.description}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-4 rounded-card border border-hairline bg-page/60 p-5">
            <div>
              <p className="font-heading text-3xl text-ink">
                {formatPrice(product.price, product.currency)}
              </p>
              <p className="mt-0.5 text-sm text-faint">per unit</p>
            </div>
            {isAuthenticated && <AddToCartButton productUuid={product.uuid} />}
          </div>

          {statHighlights.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {statHighlights.map((highlight, index) => {
                const Icon = STAT_ICONS[index % STAT_ICONS.length];
                return (
                  <div
                    key={highlight.k}
                    className="rounded-card border border-hairline bg-surface p-4"
                  >
                    <Icon size={18} className="text-primary" />
                    <p className="mt-3 font-heading text-2xl text-ink">
                      {highlight.v}
                    </p>
                    <p className="mt-0.5 text-sm text-faint">{highlight.k}</p>
                  </div>
                );
              })}
            </div>
          )}

          {product.role && (
            <div className="mt-4 flex gap-3 rounded-card bg-primary-tint p-5">
              <Layers size={18} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-grotesk text-xs font-bold uppercase tracking-wide text-primary">
                  Role in your network
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {product.role}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
