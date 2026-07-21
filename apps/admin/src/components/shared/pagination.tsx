"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "ui";

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
};

export const Pagination = ({
  page,
  totalPages,
  total,
  pageSize,
}: PaginationProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goTo = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    // Page 1 is the default, so keep it out of the URL.
    if (next <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(next));
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted">
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={16} />
          Prev
        </Button>

        <span className="text-sm text-muted">
          Page {page} of {totalPages}
        </span>

        <Button
          variant="outline"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
};
