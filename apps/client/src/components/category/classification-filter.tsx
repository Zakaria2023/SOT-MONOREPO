"use client";

import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ClassificationListItem } from "services";

type ClassificationFilterProps = {
  classifications: ClassificationListItem[];
  total: number;
  selected: string | null;
};

export const ClassificationFilter = ({
  classifications,
  total,
  selected,
}: ClassificationFilterProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startNavigation] = useTransition();

  // Read the live URL, set/clear the classification param, and navigate — the
  // server page then re-renders the filtered solution grid.
  const select = (uuid: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (uuid) {
      params.set("classification", uuid);
    } else {
      params.delete("classification");
    }
    const query = params.toString();
    startNavigation(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-surface p-5 shadow-sm transition-opacity",
        isPending && "opacity-60",
      )}
    >
      <p className="font-grotesk text-xs font-semibold tracking-widest text-faint uppercase">
        Classification
      </p>

      <ul className="mt-3 flex flex-col gap-1">
        <li>
          <button
            type="button"
            onClick={() => select(null)}
            className={cn(
              "font-grotesk flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
              selected === null
                ? "bg-primary-tint font-bold text-primary"
                : "text-ink hover:bg-surface-2",
            )}
          >
            <span>All solutions</span>
            <span
              className={cn(
                "text-xs",
                selected === null ? "text-primary" : "text-faint",
              )}
            >
              {total}
            </span>
          </button>
        </li>

        {classifications.map((classification) => {
          const isActive = selected === classification.uuid;
          return (
            <li key={classification.uuid}>
              <button
                type="button"
                onClick={() => select(classification.uuid)}
                className={cn(
                  "font-grotesk flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary-tint font-bold text-primary"
                    : "text-ink hover:bg-surface-2",
                )}
              >
                <span>{classification.name}</span>
                <span
                  className={cn(
                    "text-xs",
                    isActive ? "text-primary" : "text-faint",
                  )}
                >
                  {classification.categoryCount}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
