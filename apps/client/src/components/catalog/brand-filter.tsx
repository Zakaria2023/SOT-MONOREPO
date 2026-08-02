"use client";

import { type TreeNode } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { BrandListItem } from "services";

type BrandFilterProps = {
  tree: TreeNode<BrandListItem>[];
  selected: Set<string>;
  onToggle: (uuid: string) => void;
};

type BrandRowProps = {
  node: TreeNode<BrandListItem>;
  depth: number;
  selected: Set<string>;
  onToggle: (uuid: string) => void;
};

const BrandRow = ({ node, depth, selected, onToggle }: BrandRowProps) => {
  const checked = selected.has(node.uuid);

  return (
    <>
      <li>
        <button
          type="button"
          onClick={() => onToggle(node.uuid)}
          style={{ paddingLeft: 12 + depth * 20 }}
          className="font-grotesk flex w-full items-center gap-2.5 rounded-lg py-2 pr-3 text-sm transition-colors hover:bg-surface-2"
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
              checked
                ? "border-primary bg-primary-solid text-white"
                : "border-[#D6D3E0] bg-surface",
            )}
          >
            {checked && <Check size={13} />}
          </span>
          <span className="flex-1 text-left text-ink">{node.name}</span>
          <span className="text-xs text-faint">{node.count}</span>
        </button>
      </li>
      {node.children.map((child) => (
        <BrandRow
          key={child.uuid}
          node={child}
          depth={depth + 1}
          selected={selected}
          onToggle={onToggle}
        />
      ))}
    </>
  );
};

export const BrandFilter = ({ tree, selected, onToggle }: BrandFilterProps) => (
  <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
    <p className="font-grotesk text-xs font-semibold tracking-widest text-faint uppercase">
      Brands
    </p>
    <ul className="mt-3 flex flex-col gap-0.5">
      {tree.map((node) => (
        <BrandRow
          key={node.uuid}
          node={node}
          depth={0}
          selected={selected}
          onToggle={onToggle}
        />
      ))}
    </ul>
  </div>
);
