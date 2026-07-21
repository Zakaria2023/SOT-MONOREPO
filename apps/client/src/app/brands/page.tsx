import { documentDownloadUrl } from "@/lib/documents";
import { ArrowRight } from "lucide-react";
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
      <div className="mx-auto px-6 py-14 lg:px-12 xl:px-20">
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
        )}
      </div>
    </main>
  );
};

export default BrandsPage;
