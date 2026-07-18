"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ListErrorState } from "@/components/shared/list-error-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";

type AsyncSectionProps = {
  reloadKey: string;
  children: ReactNode;
  skeleton?: ReactNode;
};

// Wraps an async list in one place: a skeleton while it streams, an error
// state (with retry) if it throws. `reloadKey` (the search/page/parent params)
// keys the boundary so a param change remounts it — re-showing the skeleton and
// clearing any previous error.
export const AsyncSection = ({
  reloadKey,
  children,
  skeleton,
}: AsyncSectionProps) => (
  <ErrorBoundary
    key={reloadKey}
    fallbackRender={(reset) => <ListErrorState onRetry={reset} />}
  >
    <Suspense fallback={skeleton ?? <TableSkeleton />}>{children}</Suspense>
  </ErrorBoundary>
);
