import { documentDownloadUrl } from "@/lib/documents";
import { formatPrice } from "@/lib/helpers";
import { ArrowRight, ImageOff, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "services";

type ProductSectionProps = {
  products: ProductListItem[];
};

export const ProductSection = ({ products }: ProductSectionProps) => (
  <section className="w-full bg-white pt-14 pb-24">
    <div className="mx-auto max-w-6xl px-8">
      <header className="text-center">
        <h2 className="font-heading text-3xl font-extrabold text-ink">
          Hardware in this deployment
        </h2>
      </header>

      <ul className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {products.map((product) => (
          <li key={product.uuid}>
            <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-within:ring-2 focus-within:ring-primary">
              <Link
                href={`/products/${product.slug}`}
                aria-label={`View ${product.name} specifications`}
                className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
              />

              <div className="relative flex h-44 items-center justify-center overflow-hidden bg-[#F5F3FC]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.18),transparent_65%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                {product.image ? (
                  <Image
                    src={documentDownloadUrl(product.image)}
                    alt={product.name}
                    fill
                    unoptimized
                    className="object-contain p-6"
                  />
                ) : (
                  <ImageOff size={32} className="relative text-[#B7B3C4]" />
                )}

                <span className="absolute bottom-3 left-3 flex h-8 w-8 translate-y-1 items-center justify-center rounded-full bg-primary text-white opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <ArrowRight size={16} />
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-2">
                  {product.brandName && (
                    <span className="font-grotesk text-xs font-bold tracking-wide text-primary uppercase">
                      {product.brandName}
                    </span>
                  )}
                  {product.brandName && product.categoryName && (
                    <span
                      aria-hidden="true"
                      className="h-1 w-1 rounded-full bg-[#8A8F98]"
                    />
                  )}
                  {product.categoryName && (
                    <span className="font-grotesk text-xs text-[#8A8F98]">
                      {product.categoryName}
                    </span>
                  )}
                </div>

                <h3 className="font-heading mt-2 text-lg leading-snug font-bold text-ink">
                  {product.name}
                </h3>

                <p className="font-grotesk mt-2 line-clamp-2 text-sm leading-relaxed text-[#62656B]">
                  {product.blurb}
                </p>

                <div className="mt-4 flex items-center justify-between pt-1">
                  <span className="font-grotesk text-lg font-bold tabular-nums text-ink">
                    {formatPrice(product.price, product.currency)}
                  </span>

                  <button
                    type="button"
                    className="font-grotesk relative z-20 inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                  >
                    <ShoppingCart size={16} />
                    Add
                  </button>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
