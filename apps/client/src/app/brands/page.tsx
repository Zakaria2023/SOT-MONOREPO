import { documentDownloadUrl } from "@/lib/documents";
import { ArrowRight, Tag } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBrands } from "services";

export const metadata: Metadata = {
  title: "Brands · SOT Solutions",
  description:
    "Shop by brand — explore hardware from the industry's leading manufacturers, unified under a single platform.",
};

const BrandsPage = async () => {
  const brands = await getBrands();

  return (
    <main className="min-h-screen bg-page">
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
        <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
          Shop by brand
        </p>
        <h1 className="font-heading text-accent-gradient mt-3 w-fit text-5xl leading-tight font-bold">
          The brands we carry
        </h1>
        <p className="font-grotesk mt-4 max-w-xl text-base leading-relaxed text-muted">
          Pick a manufacturer to browse everything we stock from them, then add
          what you need to your cart.
        </p>

        {brands.length === 0 ? (
          <p className="font-grotesk mt-10 rounded-2xl border border-hairline bg-surface p-10 text-center text-sm text-faint">
            No brands available yet.
          </p>
        ) : (
          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <li key={brand.uuid}>
                <Link
                  href={`/brands/${brand.uuid}`}
                  className="group relative flex h-full items-center gap-4 rounded-2xl border border-hairline bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
                >
                  <div className="relative flex h-18 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2">
                    {brand.image ? (
                      <Image
                        src={documentDownloadUrl(brand.image)}
                        alt={brand.name}
                        fill
                        unoptimized
                        className="object-contain p-2"
                      />
                    ) : (
                      <Tag size={28} className="text-primary/30" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-lg font-bold text-ink">
                      {brand.name}
                    </h3>
                    {brand.description && (
                      <p className="font-grotesk mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                        {brand.description}
                      </p>
                    )}
                    <span className="font-grotesk mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
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
        )}
      </div>
    </main>
  );
};

export default BrandsPage;
