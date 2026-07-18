import { documentDownloadUrl } from "@/lib/documents";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { BrandListItem } from "services";

type BrandSectionProps = {
  brands: BrandListItem[];
};

export const BrandSection = ({ brands }: BrandSectionProps) => (
  <section className="w-full bg-surface py-24">
    <div className="mx-auto px-6 lg:px-12 xl:px-20">
      <header className="mx-auto max-w-2xl text-center">
        <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
          The brands we carry
        </p>
        <h2 className="font-heading mt-3 text-4xl leading-tight text-ink">
          Trusted names, one platform.
        </h2>
        <p className="font-grotesk mt-4 text-lg leading-relaxed text-muted">
          We source, stage and support hardware from the industry&apos;s leading
          manufacturers — unified under a single deployment.
        </p>
      </header>

      <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <li key={brand.uuid}>
            <Link
              href={`/brands/${brand.uuid}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="relative h-20 w-full shrink-0">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(139,123,255,0.35),transparent_60%),radial-gradient(circle_at_80%_75%,rgba(34,211,238,0.28),transparent_55%)]"
                />
              </div>

              <div className="relative -mt-9 flex justify-center">
                <div className="flex h-18 w-18 items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-surface shadow-md ring-4 ring-surface">
                  {brand.image ? (
                    <Image
                      src={documentDownloadUrl(brand.image)}
                      alt={brand.name}
                      fill
                      unoptimized
                      className="object-contain p-2.5"
                    />
                  ) : (
                    <span className="font-heading text-2xl font-bold text-primary">
                      {brand.name.charAt(0)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col items-center px-6 pt-3 pb-6 text-center">
                <h3 className="font-heading text-lg font-bold text-ink">
                  {brand.name}
                </h3>
                {brand.description && (
                  <p className="font-grotesk mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
                    {brand.description}
                  </p>
                )}
                <span className="font-grotesk mt-4 flex w-full items-center justify-center gap-1.5 border-t border-hairline pt-4 text-sm font-semibold text-primary">
                  {brand.productCount}{" "}
                  {brand.productCount === 1 ? "product" : "products"}
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex justify-center">
        <Link
          href="/brands"
          className="font-grotesk group inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-surface px-6 py-3 font-semibold text-primary shadow-sm transition-colors hover:border-primary/40"
        >
          View all brands
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-1"
          />
        </Link>
      </div>
    </div>
  </section>
);
