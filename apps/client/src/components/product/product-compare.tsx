import { documentDownloadUrl } from "@/lib/documents";
import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ProductDetail, ProductListItem } from "services";

type ProductCompareProps = {
  current: ProductDetail;
  others: ProductListItem[];
  categoryHighlights: NonNullable<ProductDetail["highlights"]>;
};

export const ProductCompare = ({
  current,
  others,
  categoryHighlights,
}: ProductCompareProps) => {
  if (others.length === 0) return null;

  const products = [current, ...others];

  // Products share their category's spec structure, so fall back to the
  // category highlights for any product that has none of its own.
  const highlightsFor = (product: ProductListItem) =>
    product.highlights?.length ? product.highlights : categoryHighlights;

  const valueFor = (product: ProductListItem, key: string): string =>
    highlightsFor(product).find((highlight) => highlight.k === key)?.v ?? "—";

  const keys: string[] = [];
  for (const product of products) {
    for (const highlight of highlightsFor(product)) {
      if (!keys.includes(highlight.k)) keys.push(highlight.k);
    }
  }
  if (keys.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 lg:px-8">
      <h2 className="font-heading text-3xl text-ink">Compare the line-up</h2>
      <p className="mt-2 text-muted">
        How this product lines up against others in{" "}
        {current.categoryName ?? "the same category"}.
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-160 border-collapse">
          <thead>
            <tr>
              <th className="w-44" />
              {products.map((product) => {
                const isCurrent = product.uuid === current.uuid;
                return (
                  <th
                    key={product.uuid}
                    className={`p-5 align-bottom ${isCurrent ? "rounded-t-card bg-primary-tint/50" : ""}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-control border border-hairline bg-surface">
                        {product.image ? (
                          <Image
                            src={documentDownloadUrl(product.image)}
                            alt={product.name}
                            fill
                            unoptimized
                            className="object-contain p-1.5"
                          />
                        ) : (
                          <ShieldCheck size={20} className="text-primary/50" />
                        )}
                      </div>
                      <Link
                        href={`/products/${product.slug}`}
                        className="font-semibold text-ink transition-colors hover:text-primary"
                      >
                        {product.name}
                      </Link>
                      {isCurrent && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
                          This product
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key} className="border-t border-hairline">
                <td className="py-3.5 pr-4 text-sm text-faint">{key}</td>
                {products.map((product) => {
                  const isCurrent = product.uuid === current.uuid;
                  return (
                    <td
                      key={product.uuid}
                      className={`py-3.5 text-center text-sm ${isCurrent ? "bg-primary-tint/30 font-semibold text-ink" : "text-muted"}`}
                    >
                      {valueFor(product, key)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
