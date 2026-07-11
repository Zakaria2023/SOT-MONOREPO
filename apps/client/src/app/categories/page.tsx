import { documentDownloadUrl } from "@/lib/documents";
import { ArrowRight, Layers } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCategories } from "services";

export const metadata: Metadata = {
  title: "Solutions · SOT Solutions",
  description:
    "Shop by solution — add a whole category of networking, infrastructure or security hardware to your deployment.",
};

const CategoriesPage = async () => {
  const categories = await getCategories();

  return (
    <main className="min-h-screen bg-page">
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
        <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
          Shop by solution
        </p>
        <h1 className="font-heading text-accent-gradient mt-3 w-fit text-5xl leading-tight font-bold">
          Deploy by the whole solution
        </h1>
        <p className="font-grotesk mt-4 max-w-xl text-base leading-relaxed text-muted">
          Pick a category and add the entire solution to your cart in one click —
          then send it as a BOQ for review.
        </p>

        {categories.length === 0 ? (
          <p className="font-grotesk mt-10 rounded-2xl border border-hairline bg-surface p-10 text-center text-sm text-faint">
            No solutions available yet.
          </p>
        ) : (
          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <li key={category.uuid}>
                <Link
                  href={`/categories/${category.uuid}`}
                  className="group relative flex h-64 flex-col justify-end overflow-hidden rounded-2xl border border-hairline bg-surface-2 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
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
                    <div className="absolute inset-0 flex items-center justify-center text-primary/30">
                      <Layers size={44} />
                    </div>
                  )}

                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-transparent"
                  />

                  <span className="absolute top-4 left-4 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "product" : "products"}
                  </span>

                  <div className="relative p-6">
                    <h3 className="font-heading text-2xl leading-tight text-white">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="font-grotesk mt-1 line-clamp-2 text-sm leading-relaxed text-white/60">
                        {category.description}
                      </p>
                    )}
                    <span className="font-grotesk mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-cyan">
                      Shop solution
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

export default CategoriesPage;
