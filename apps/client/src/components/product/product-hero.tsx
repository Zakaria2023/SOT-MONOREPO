import { AddToCartButton } from "@/components/home/add-to-cart-button";
import { BuyNowButton } from "@/components/product/buy-now-button";
import { documentDownloadUrl } from "@/lib/documents";
import { formatPrice } from "utils";
import {
  ArrowLeft,
  Cpu,
  FileText,
  Gauge,
  Globe,
  Layers,
  Network,
  PackageX,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ProductDetail } from "services";

type SpecAttribute = {
  label: string;
  value: string;
};

type ProductHeroProps = {
  product: ProductDetail;
  attributes: SpecAttribute[];
};

const STAT_ICONS: LucideIcon[] = [Gauge, ShieldCheck, Users, Layers, Cpu, Network];

export const ProductHero = ({ product, attributes }: ProductHeroProps) => {
  const chipAttributes = attributes.slice(0, 2);
  const statAttributes = attributes.slice(0, 4);
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

            {chipAttributes.length > 0 && (
              <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                {chipAttributes.map((attribute) => (
                  <span
                    key={attribute.label}
                    className="inline-flex items-center gap-2 rounded-control border border-hairline bg-surface/90 px-3 py-1.5 text-sm shadow-sm backdrop-blur"
                  >
                    <Gauge size={14} className="text-primary" />
                    <span className="font-semibold text-ink">
                      {attribute.value}
                    </span>
                    <span className="text-faint">{attribute.label}</span>
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

          {product.shortDescription && (
            <p className="mt-3 text-base font-medium text-ink">
              {product.shortDescription}
            </p>
          )}

          {product.description && (
            <p className="mt-4 text-base leading-relaxed text-muted">
              {product.description}
            </p>
          )}

          {product.datasheet && (
            <Link
              href={documentDownloadUrl(product.datasheet)}
              target="_blank"
              className="mt-4 inline-flex w-fit items-center gap-2 rounded-control border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary"
            >
              <FileText size={16} /> Download datasheet (free)
            </Link>
          )}

          <div className="mt-6 flex flex-col gap-4 rounded-card border border-hairline bg-page/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-heading text-3xl text-ink">
                {formatPrice(product.price, product.currency)}
              </p>
              <p className="mt-0.5 text-sm text-faint">per unit</p>
            </div>
            {product.isAvailable ? (
              <div className="flex items-center gap-2">
                <BuyNowButton />
                <AddToCartButton productUuid={product.uuid} />
              </div>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-control border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-faint">
                <PackageX size={16} /> Currently unavailable
              </span>
            )}
          </div>

          {statAttributes.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {statAttributes.map((attribute, index) => {
                const Icon = STAT_ICONS[index % STAT_ICONS.length];
                return (
                  <div
                    key={attribute.label}
                    className="rounded-card border border-hairline bg-surface p-4"
                  >
                    <Icon size={18} className="text-primary" />
                    <p className="mt-3 font-heading text-2xl text-ink">
                      {attribute.value}
                    </p>
                    <p className="mt-0.5 text-sm text-faint">
                      {attribute.label}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {(product.warrantyPeriod ||
            product.warrantyRegion ||
            product.countryOfOrigin) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.warrantyRegion && (
                <span className="inline-flex items-center gap-1.5 rounded-control border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
                  <ShieldCheck size={14} className="text-primary" />
                  Official {product.warrantyRegion} warranty
                </span>
              )}
              {product.warrantyPeriod && (
                <span className="inline-flex items-center gap-1.5 rounded-control border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
                  <ShieldCheck size={14} className="text-primary" />
                  {product.warrantyPeriod} warranty
                </span>
              )}
              {product.warrantyExtendable && (
                <span className="inline-flex items-center gap-1.5 rounded-control border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
                  <Layers size={14} className="text-primary" />
                  Extendable
                </span>
              )}
              {product.countryOfOrigin && (
                <span className="inline-flex items-center gap-1.5 rounded-control border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
                  <Globe size={14} className="text-primary" />
                  Made in {product.countryOfOrigin}
                </span>
              )}
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
