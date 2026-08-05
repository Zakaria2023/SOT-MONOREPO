"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** What is being counted, for the range line: "products", "brands". */
  noun: string;
};

/**
 * Page controls for the catalogue lists.
 *
 * The page lives in the URL, so a link to page 3 of a filtered catalogue opens on
 * page 3 of that filter — and `scroll: false` keeps the viewport where it is,
 * because the shopper is looking at the grid, not at the page heading above it.
 *
 * Page 1 is never written to the URL. It is the default, and a "?page=1" that
 * only ever appears after a click makes two URLs for one screen.
 */
export const Pagination = ({
  page,
  totalPages,
  total,
  pageSize,
  noun,
}: PaginationProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) {
    return null;
  }

  const goTo = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(next));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const button =
    "font-grotesk flex items-center gap-1.5 rounded-xl border border-hairline bg-surface px-4 py-2 text-sm text-ink transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline";

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex flex-wrap items-center justify-between gap-4"
    >
      <p className="font-grotesk text-sm text-muted">
        Showing {from}–{to} of {total} {noun}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className={cn(button)}
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <span className="font-grotesk text-sm text-muted">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className={cn(button)}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
};
