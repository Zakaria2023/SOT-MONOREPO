type BoardSkeletonProps = {
  columns?: number;
  cardsPerColumn?: number;
};

// Static placeholder for the reorderable board, used as a <Suspense> fallback
// while the categories/brands stream in. Mirrors the real grid of node cards so
// the layout doesn't jump when data arrives.
export const BoardSkeleton = ({
  columns = 4,
  cardsPerColumn = 3,
}: BoardSkeletonProps) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] items-start gap-4">
    {Array.from({ length: columns }).map((_, columnIndex) => (
      <div
        key={columnIndex}
        className="flex flex-col rounded-card border border-hairline bg-page"
      >
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          <div className="h-4 w-28 animate-pulse rounded bg-hover" />
          <div className="h-5 w-6 animate-pulse rounded-full bg-hover" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: cardsPerColumn }).map((_, cardIndex) => (
            <div
              key={cardIndex}
              className="flex items-center gap-2.5 rounded-control border border-hairline bg-surface p-2.5"
            >
              <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-hover" />
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-control bg-hover" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-hover" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-hover" />
              </div>
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-control bg-hover" />
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-control bg-hover" />
            </div>
          ))}
        </div>
      </div>
    ))}
    <span className="sr-only">Loading…</span>
  </div>
);
