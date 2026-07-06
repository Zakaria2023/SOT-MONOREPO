import { documentDownloadUrl } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { ArrowRight, ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CategoryListItem } from "services";

type CategorySectionProps = {
  categories: CategoryListItem[];
};

export const CategorySection = ({ categories }: CategorySectionProps) => {
  const featured = categories.slice(0, 5);

  return (
    <section className="w-full bg-white py-24">
      <div className="mx-auto max-w-6xl px-8">
        <header>
          <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
            Top categories
          </p>
          <h2 className="font-heading mt-3 max-w-2xl text-5xl leading-tight font-extrabold text-ink">
            Shop by what you&apos;re building.
          </h2>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="font-grotesk max-w-md text-base leading-relaxed text-[#62656B]">
              Browse the categories our engineers deploy most — every product
              genuine, configured and installation-ready.
            </p>

            <Link
              href="/categories"
              className="font-grotesk group inline-flex items-center gap-1.5 font-bold text-primary"
            >
              View all categories
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </header>

        <ul className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3 md:auto-rows-[230px]">
          {featured.map((category, index) => {
            const isFeatured = index === 0;

            return (
              <li
                key={category.uuid}
                className={isFeatured ? "md:col-span-2 md:row-span-2" : ""}
              >
                <Link
                  href={`/categories/${category.uuid}`}
                  className="group relative flex h-72 flex-col justify-end overflow-hidden rounded-[20px] bg-[#0C0C11] shadow-sm ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-24px_rgba(124,58,237,0.55)] hover:ring-primary/40 md:h-full"
                >
                  {category.image ? (
                    <Image
                      src={documentDownloadUrl(category.image)}
                      alt={category.name}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/15">
                      <ImageOff size={40} />
                    </div>
                  )}

                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-transparent"
                  />

                  <span className="font-grotesk absolute top-4 left-4 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                    {category.productCount} products
                  </span>

                  <div className="relative p-6">
                    <h3
                      className={cn(
                        "font-heading leading-tight font-extrabold text-white",
                        isFeatured ? "text-3xl" : "text-2xl",
                      )}
                    >
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="font-grotesk mt-2 line-clamp-2 text-sm leading-relaxed text-white/60">
                        {category.description}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
