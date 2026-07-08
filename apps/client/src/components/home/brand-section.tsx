import { documentDownloadUrl } from "@/lib/documents";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { SelectBrands } from "services";

type BrandSectionProps = {
  brands: SelectBrands[];
};

export const BrandSection = ({ brands }: BrandSectionProps) => (
  <section className="w-full bg-white py-24">
    <div className="mx-auto max-w-6xl px-8">
      <header className="mx-auto max-w-2xl text-center">
        <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
          The brands we carry
        </p>
        <h2 className="font-heading mt-3 text-4xl leading-tight text-ink">
          Trusted names, one platform.
        </h2>
        <p className="font-grotesk mt-4 text-lg leading-relaxed text-[#62656B]">
          We source, stage and support hardware from the industry&apos;s leading
          manufacturers — unified under a single deployment.
        </p>
      </header>

      <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <li key={brand.uuid}>
            <article className="group flex h-full items-center gap-4 rounded-2xl border border-[#ECEEF1] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
              <div className="relative flex h-18 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F4F5F8]">
                {brand.image ? (
                  <Image
                    src={documentDownloadUrl(brand.image)}
                    alt={brand.name}
                    fill
                    unoptimized
                    className="object-contain p-2"
                  />
                ) : (
                  <span className="font-heading text-xl font-bold text-[#8A8F98]">
                    {brand.name.charAt(0)}
                  </span>
                )}
              </div>

              <div>
                <h3 className="font-heading text-lg font-bold text-ink">
                  {brand.name}
                </h3>
                {brand.description && (
                  <p className="font-grotesk mt-1 line-clamp-2 text-sm leading-relaxed text-[#62656B]">
                    {brand.description}
                  </p>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex justify-center">
        <Link
          href="/brands"
          className="font-grotesk group inline-flex items-center gap-1.5 rounded-[10px] border border-[#ECEEF1] bg-white px-6 py-3 font-semibold text-primary shadow-sm transition-colors hover:border-primary/40"
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
