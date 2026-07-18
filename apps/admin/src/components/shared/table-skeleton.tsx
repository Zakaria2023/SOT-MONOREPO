type TableSkeletonProps = {
  title?: string;
  rows?: number;
};

// A static placeholder that mirrors the list-page layout (heading, toolbar,
// table) so route navigations show structure instead of a blank screen.
export const TableSkeleton = ({ title = "Loading", rows = 8 }: TableSkeletonProps) => (
  <div className="flex flex-col gap-5">
    <div className="flex items-center justify-between">
      <div className="h-8 w-48 animate-pulse rounded-control bg-hover" />
      <div className="h-9 w-32 animate-pulse rounded-control bg-hover" />
    </div>

    <div className="h-11 w-full max-w-sm animate-pulse rounded-control bg-hover" />

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

    <span className="sr-only">{title}</span>
  </div>
);
