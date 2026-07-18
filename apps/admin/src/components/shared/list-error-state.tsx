"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "ui";

type ListErrorStateProps = {
  onRetry: () => void;
};

export const ListErrorState = ({ onRetry }: ListErrorStateProps) => {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-hairline bg-surface px-5 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-tint text-danger">
        <TriangleAlert size={20} />
      </span>
      <p className="text-sm text-muted">
        Something went wrong loading this list.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          // Clear the boundary, then re-run the server fetch.
          onRetry();
          router.refresh();
        }}
      >
        Try again
      </Button>
    </div>
  );
};
