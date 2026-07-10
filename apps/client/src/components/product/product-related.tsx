import { documentDownloadUrl } from "@/lib/documents";
import { formatPrice } from "utils";
import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "services";

type ProductRelatedProps = {
  products: ProductListItem[];
};

export const ProductRelated = ({ products }: ProductRelatedProps) => {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 lg:px-8">
      <h2 className="font-heading text-3xl text-ink">Pairs well with</h2>
      <p className="mt-2 text-muted">
        Other devices in the same range — tap a tile to jump to its page.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {products.map((product) => (
          <Link
            key={product.uuid}
            href={`/products/${product.slug}`}
            className="group relative flex h-44 flex-col justify-between overflow-hidden rounded-card border border-hairline bg-linear-to-br from-primary-tint to-[#efe9fb] p-5 transition-shadow hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              {product.image ? (
                <div className="relative h-10 w-10">
                  <Image
                    src={documentDownloadUrl(product.image)}
                    alt={product.name}
                    fill
                    unoptimized
                    className="object-contain"
                  />
                </div>
              ) : (
                <ShieldCheck size={22} className="text-primary" />
              )}
              <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
                {formatPrice(product.price, product.currency)}
              </span>
            </div>

            <div>
              {product.categoryName && (
                <p className="font-grotesk text-xs font-semibold uppercase tracking-wide text-primary">
                  {product.categoryName}
                </p>
              )}
              <p className="mt-0.5 font-semibold text-ink">{product.name}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
