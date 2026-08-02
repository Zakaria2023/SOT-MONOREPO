import { ClassificationFilter } from "@/components/category/classification-filter";
import { documentDownloadUrl } from "@/lib/documents";
import { pageMetadata } from "@/lib/seo";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCategories, getClassifications } from "services";

export const metadata: Metadata = pageMetadata({
  title: "Solutions",
  description:
    "Shop by solution — add a whole category of networking, infrastructure or security hardware to your deployment.",
  path: "/categories",
});

// Reads the live category tree and has no dynamic API of its own, so it would
// otherwise be prerendered once at build and serve a frozen tree on live —
// new/reparented categories would never appear. Render per request instead.
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ classification?: string }>;
};

const CategoriesPage = async ({ searchParams }: Props) => {
  const [{ classification }, categories, classifications] = await Promise.all([
    searchParams,
    getCategories(),
    getClassifications(),
  ]);

  const selectedClassification = classification ?? null;
  const visibleCategories = selectedClassification
    ? categories.filter(
        (category) => category.classificationUuid === selectedClassification,
      )
    : categories;

  return (
    <main className="min-h-screen bg-page">
      <div className="mx-auto px-6 py-14 lg:px-12 xl:px-20">
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

        <div className="mt-10 flex flex-col gap-8 lg:flex-row">
          <aside className="shrink-0 lg:w-80 xl:w-96">
            <ClassificationFilter
              classifications={classifications}
              total={categories.length}
              selected={selectedClassification}
            />
          </aside>

          <div className="min-w-0 flex-1">
            {visibleCategories.length === 0 ? (
              <p className="font-grotesk rounded-2xl border border-hairline bg-surface p-10 text-center text-sm text-faint">
                {categories.length === 0
                  ? "No solutions available yet."
                  : "No solutions match this classification."}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleCategories.map((category) => (
                  <li key={category.uuid}>
                    <Link
                      href={`/products?category=${category.uuid}`}
                      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                    >
                      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-surface-2">
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
                          {category.productCount}{" "}
                          {category.productCount === 1 ? "product" : "products"}
                        </span>

                        <h3 className="font-heading absolute right-4 bottom-3 left-4 text-xl leading-tight text-white">
                          {category.name}
                        </h3>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        {category.description && (
                          <p className="font-grotesk line-clamp-2 text-sm leading-relaxed text-muted">
                            {category.description}
                          </p>
                        )}
                        <span className="font-grotesk mt-auto flex items-center gap-1.5 pt-3 text-sm font-semibold text-primary">
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
        </div>
      </div>
    </main>
  );
};

export default CategoriesPage;
