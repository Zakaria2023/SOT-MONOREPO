import { documentImageUrl } from "@/lib/documents";
import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComparisonRow, ProductDetail, ProductListItem } from "services";

type ProductCompareProps = {
  current: ProductDetail;
  others: ProductListItem[];
  // Already rendered server-side, keyed by product uuid — the same formatter the
  // spec table and the engine's findings use, so one product never reads two ways
  // in two places on the same page. A row only reaches here if someone answers it.
  rows: ComparisonRow[];
};

export const ProductCompare = ({
  current,
  others,
  rows,
}: ProductCompareProps) => {
  if (others.length === 0 || rows.length === 0) {
    return null;
  }

  const products = [current, ...others];

  return (
    <section className="mx-auto px-6 pt-16 lg:px-12 xl:px-20">
      <h2 className="font-heading text-3xl text-ink">Compare the line-up</h2>
      <p className="mt-2 text-muted">
        How this product lines up against others in{" "}
        {current.categoryName ?? "the same category"}.
      </p>

      {/* The highlight is an alpha of --color-primary rather than
          --color-primary-tint. That token is a solid #f4f1fb built to sit on
          bg-surface (white); against bg-page (#f5f4fa) it resolves to
          (244,242,250) versus the page's (245,244,250) — off by one or two per
          channel, so the light theme showed no highlighted column at all. An
          alpha composites against whatever is actually behind it, which is what
          makes one value work in both themes. */}
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
                    className={`p-5 align-bottom ${isCurrent ? "rounded-t-card bg-primary/10" : ""}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-control border border-hairline bg-surface">
                        {product.image ? (
                          <Image
                            src={documentImageUrl(product.image)}
                            alt={product.name}
                            fill
                            sizes="48px"
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
                        <span className="rounded-full bg-primary-solid px-2 py-0.5 text-xs font-semibold text-white">
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
            {rows.map((row) => (
              <tr key={row.uuid} className="border-t border-hairline">
                <td className="py-3.5 pr-4 text-sm text-faint">{row.label}</td>
                {products.map((product) => {
                  const isCurrent = product.uuid === current.uuid;
                  return (
                    <td
                      key={product.uuid}
                      className={`py-3.5 text-center text-sm ${isCurrent ? "bg-primary/6 font-semibold text-ink" : "text-muted"}`}
                    >
                      {row.values[product.uuid] ?? "—"}
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
