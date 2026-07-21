type TableSkeletonProps = {
  rows?: number;
};

// Static placeholder for the table area, used as a <Suspense> fallback while a
// searched/paginated list streams in. The page chrome (heading, toolbar,
// filters) stays mounted outside the boundary, so this renders the table only.
export const TableSkeleton = ({ rows = 8 }: TableSkeletonProps) => (
  <div className="flex flex-col gap-2">
    <div className="overflow-hidden rounded-card border border-hairline bg-surface">
      <div className="h-12 border-b border-hairline bg-hover" />
      <div className="divide-y divide-hairline-soft">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-6 py-4">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-control bg-hover" />
            <div className="h-4 flex-1 animate-pulse rounded bg-hover" />
            <div className="h-4 w-24 animate-pulse rounded bg-hover" />
            <div className="h-4 w-16 animate-pulse rounded bg-hover" />
          </div>
        ))}
      </div>
    </div>
    <span className="sr-only">Loading…</span>
  </div>
);
