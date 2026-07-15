import { documentDownloadUrl } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CategoryListItem } from "services";

type CategorySectionProps = {
  categories: CategoryListItem[];
};

export const CategorySection = ({ categories }: CategorySectionProps) => {
  const featured = categories.slice(0, 5);

  return (
    <section className="w-full bg-surface py-24">
      <div className="mx-auto max-w-6xl px-8">
        <header>
          <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
            Top categories
          </p>
          <h2 className="font-heading mt-3 max-w-2xl text-5xl leading-tight text-ink">
            Shop by what you&apos;re building.
          </h2>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="font-grotesk max-w-md text-base leading-relaxed text-muted">
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

        <ul className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3 md:auto-rows-57.5">
          {featured.map((category, index) => {
            const isFeatured = index === 0;

            return (
              <li
                key={category.uuid}
                className={isFeatured ? "md:col-span-2 md:row-span-2" : ""}
              >
                <Link
                  href={`/categories/${category.uuid}`}
                  className="group relative flex h-72 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg md:h-full"
                >
                  <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-2">
                    {category.image ? (
                      <Image
                        src={documentDownloadUrl(category.image)}
                        alt={category.name}
                        fill
                        unoptimized
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(139,123,255,0.3),transparent_60%),radial-gradient(circle_at_75%_70%,rgba(34,211,238,0.25),transparent_55%)]"
                      />
                    )}

                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent"
                    />

                    <span className="font-grotesk absolute top-3 right-3 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                      {category.productCount} products
                    </span>

                    <h3
                      className={cn(
                        "font-heading absolute right-4 bottom-3 left-4 leading-tight text-white",
                        isFeatured ? "text-3xl" : "text-xl",
                      )}
                    >
                      {category.name}
                    </h3>
                  </div>

                  <div className="flex shrink-0 flex-col p-5">
                    {category.description && (
                      <p className="font-grotesk line-clamp-2 text-sm leading-relaxed text-muted">
                        {category.description}
                      </p>
                    )}
                    <span className="font-grotesk mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Shop solution
                      <ArrowRight
                        size={15}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
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
