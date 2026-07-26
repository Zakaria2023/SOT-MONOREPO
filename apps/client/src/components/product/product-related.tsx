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
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto px-6 pt-16 lg:px-12 xl:px-20">
      <h2 className="font-heading text-3xl text-ink">Pairs well with</h2>
      <p className="mt-2 text-muted">
        Other devices in the same range — tap a tile to jump to its page.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {products.map((product) => (
          <Link
            key={product.uuid}
            href={`/products/${product.slug}`}
            className="group relative flex h-44 flex-col justify-between overflow-hidden rounded-2xl border border-hairline bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(139,123,255,0.16),transparent_60%),radial-gradient(circle_at_85%_85%,rgba(34,211,238,0.14),transparent_55%)]"
            />

            <div className="relative flex items-start justify-between">
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
              <span className="rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink">
                {formatPrice(product.price, product.currency)}
              </span>
            </div>

            <div className="relative">
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
