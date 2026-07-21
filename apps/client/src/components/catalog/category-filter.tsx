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

type CategoryTreeItemProps = {
  node: TreeNode<CategoryListItem>;
  depth: number;
  selected: string | null;
  expanded: Set<string>;
  onSelect: (uuid: string | null) => void;
  onToggle: (uuid: string) => void;
};

// One category row, rendered recursively so the whole tree shows at any depth.
// Top-level rows carry the icon; deeper rows are indented text rows.
const CategoryTreeItem = ({
  node,
  depth,
  selected,
  expanded,
  onSelect,
  onToggle,
}: CategoryTreeItemProps) => {
  const isActive = selected === node.uuid;
  const isOpen = expanded.has(node.uuid);
  const hasChildren = node.children.length > 0;
  const isTop = depth === 0;

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1 rounded-lg pr-1 transition-colors",
          isActive ? "bg-primary-tint" : "hover:bg-surface-2",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(node.uuid)}
          style={{ paddingLeft: isTop ? undefined : 8 + depth * 14 }}
          className="font-grotesk flex flex-1 items-center gap-2.5 px-2 py-2 text-left text-sm"
        >
          {isTop && (
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
          )}
          <span
            className={cn(
              "flex-1",
              isActive
                ? "font-bold text-primary"
                : isTop
                  ? "text-ink"
                  : "text-muted",
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

        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(node.uuid)}
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:text-primary"
          >
            <ChevronDown
              size={16}
              className={cn("transition-transform", isOpen && "rotate-180")}
            />
          </button>
        )}
      </div>

      {isOpen && hasChildren && (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.uuid}
              node={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
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

        {tree.map((node) => (
          <CategoryTreeItem
            key={node.uuid}
            node={node}
            depth={0}
            selected={selected}
            expanded={expanded}
            onSelect={onSelect}
            onToggle={toggle}
          />
        ))}
      </ul>
    </div>
  );
};
