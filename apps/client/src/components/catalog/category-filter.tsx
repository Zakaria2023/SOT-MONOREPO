"use client";

import { type TreeNode } from "@/lib/catalog";
import { documentDownloadUrl } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { CategoryListItem } from "services";

type CategoryFilterProps = {
  tree: TreeNode<CategoryListItem>[];
  total: number;
  selected: string | null;
  onSelect: (uuid: string | null) => void;
};

export const CategoryFilter = ({
  tree,
  total,
  selected,
  onSelect,
}: CategoryFilterProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (uuid: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
      <p className="font-grotesk text-xs font-semibold tracking-widest text-faint uppercase">
        Categories
      </p>

      <ul className="mt-3 flex flex-col gap-1">
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              "font-grotesk flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
              selected === null
                ? "bg-primary-tint font-bold text-primary"
                : "text-ink hover:bg-surface-2",
            )}
          >
            <span>All products</span>
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

        {tree.map((node) => {
          const isActive = selected === node.uuid;
          const isOpen = expanded.has(node.uuid);

          return (
            <li key={node.uuid}>
              <div
                className={cn(
                  "flex items-center gap-1 rounded-lg pr-1 transition-colors",
                  isActive ? "bg-primary-tint" : "hover:bg-surface-2",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(node.uuid)}
                  className="font-grotesk flex flex-1 items-center gap-2.5 px-2 py-2 text-left text-sm"
                >
                  <span
                    className={cn(
                      "relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg",
                      isActive ? "bg-surface" : "bg-primary-tint",
                    )}
                  >
                    {node.image ? (
                      <Image
                        src={documentDownloadUrl(node.image)}
                        alt={node.name}
                        fill
                        unoptimized
                        className="object-contain p-0.5"
                      />
                    ) : (
                      <span className="font-heading text-xs font-bold text-primary">
                        {node.name.charAt(0)}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex-1",
                      isActive ? "font-bold text-primary" : "text-ink",
                    )}
                  >
                    {node.name}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      isActive ? "text-primary" : "text-faint",
                    )}
                  >
                    {node.count}
                  </span>
                </button>

                {node.children.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggle(node.uuid)}
                    aria-label={
                      isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:text-primary"
                  >
                    <ChevronDown
                      size={16}
                      className={cn("transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                )}
              </div>

              {isOpen && node.children.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 pl-9">
                  {node.children.map((child) => {
                    const childActive = selected === child.uuid;
                    return (
                      <li key={child.uuid}>
                        <button
                          type="button"
                          onClick={() => onSelect(child.uuid)}
                          className={cn(
                            "font-grotesk flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors",
                            childActive
                              ? "bg-primary-tint font-bold text-primary"
                              : "text-muted hover:bg-surface-2",
                          )}
                        >
                          <span>{child.name}</span>
                          <span
                            className={cn(
                              "text-xs",
                              childActive ? "text-primary" : "text-faint",
                            )}
                          >
                            {child.count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
