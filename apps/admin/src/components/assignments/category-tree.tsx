"use client";

import { ChevronRight, FolderTree, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CategoryListItem } from "services";

// ---------------------------------------------------------------------------
// The category tree.
//
// It is the navigation for this whole screen, so it earns the full height of
// the viewport rather than a fixed-height box that scrolls a hundred rows
// through a 34rem window. Deep branches collapse, because the useful question
// is "what is under Networking", not "what are all 200 categories".
//
// One thing it must never hide: inheritance runs DOWN. What is assigned to
// Switch reaches SOHO, SMB and Industrial whether or not anyone opens them —
// so a selected node highlights its whole ancestor path, and its descendants
// are marked as inheriting, right where the author is choosing.
// ---------------------------------------------------------------------------

type CategoryTreeProps = {
  categories: CategoryListItem[];
  // uuid of the selected category, or null before anything is picked.
  selected: string | null;
};

type TreeNode = {
  category: CategoryListItem;
  children: TreeNode[];
};

type BranchProps = {
  nodes: TreeNode[];
  selected: string | null;
  // Ancestors of the selected node, so the path to it can be drawn as a trail
  // rather than leaving one highlighted row floating with no context.
  ancestors: Set<string>;
  // Descendants of the selected node — everything that inherits from it.
  descendants: Set<string>;
  open: Set<string>;
  onToggle: (uuid: string) => void;
  // While searching, everything that matched stays expanded and nothing else
  // renders, so the tree behaves like a filter rather than a puzzle.
  filtering: boolean;
};

const buildTree = (categories: CategoryListItem[]): TreeNode[] => {
  const childrenOf = new Map<string | null, CategoryListItem[]>();
  for (const category of categories) {
    const key = category.parentUuid ?? null;
    const list = childrenOf.get(key) ?? [];
    list.push(category);
    childrenOf.set(key, list);
  }

  // Depth is not carried on the node: each level is indented by nesting the
  // child list inside its parent's, so the guide line and the indent come from
  // the same element rather than from a number two components have to agree on.
  const build = (parentUuid: string | null): TreeNode[] =>
    (childrenOf.get(parentUuid) ?? []).map((category) => ({
      category,
      children: build(category.uuid),
    }));

  return build(null);
};

/** Every uuid on the path from the root down to `target`, target excluded. */
const pathTo = (
  categories: CategoryListItem[],
  target: string | null,
): Set<string> => {
  const path = new Set<string>();
  if (!target) {
    return path;
  }
  const byUuid = new Map(categories.map((entry) => [entry.uuid, entry]));
  let current = byUuid.get(target)?.parentUuid ?? null;
  // Guard against a cycle in the data rather than hanging the render.
  while (current && !path.has(current)) {
    path.add(current);
    current = byUuid.get(current)?.parentUuid ?? null;
  }
  return path;
};

/** Everything below `target` — the categories that inherit from it. */
const subtreeOf = (
  categories: CategoryListItem[],
  target: string | null,
): Set<string> => {
  const found = new Set<string>();
  if (!target) {
    return found;
  }
  const childrenOf = new Map<string | null, CategoryListItem[]>();
  for (const category of categories) {
    const key = category.parentUuid ?? null;
    const list = childrenOf.get(key) ?? [];
    list.push(category);
    childrenOf.set(key, list);
  }
  const walk = (uuid: string): void => {
    for (const child of childrenOf.get(uuid) ?? []) {
      if (found.has(child.uuid)) {
        continue;
      }
      found.add(child.uuid);
      walk(child.uuid);
    }
  };
  walk(target);
  return found;
};

/**
 * Prune the tree to nodes matching the term, keeping the ancestors that lead to
 * them. A match deep in a branch is useless without the branch it sits in.
 */
const prune = (nodes: TreeNode[], term: string): TreeNode[] =>
  nodes.flatMap((node) => {
    const children = prune(node.children, term);
    const hit = node.category.name.toLowerCase().includes(term);
    if (!hit && children.length === 0) {
      return [];
    }
    return [{ ...node, children }];
  });

const Branch = ({
  nodes,
  selected,
  ancestors,
  descendants,
  open,
  onToggle,
  filtering,
}: BranchProps) => (
  <ul className="flex flex-col">
    {nodes.map((node) => {
      const { uuid, name } = node.category;
      const active = uuid === selected;
      const onPath = ancestors.has(uuid);
      const inherits = descendants.has(uuid);
      const hasChildren = node.children.length > 0;
      // A search result is always open; otherwise the node's own state, and a
      // node on the path to the selection opens so the selection is reachable.
      const expanded = filtering || open.has(uuid) || onPath;

      return (
        <li key={uuid}>
          <div
            className={`group flex items-center rounded-control ${
              active
                ? "bg-primary-tint ring-1 ring-primary-tint-border ring-inset"
                : "hover:bg-hover"
            }`}
          >
            {/* Twisty, or a dot in its place on a leaf. Both occupy the same
                width so every label in a level starts on the same x — that
                alignment is what makes depth readable at a glance. */}
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggle(uuid)}
                aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
                aria-expanded={expanded}
                className="flex h-7 w-5 shrink-0 items-center justify-center text-faint hover:text-ink"
              >
                <ChevronRight
                  size={13}
                  className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </button>
            ) : (
              <span
                aria-hidden
                className="flex h-7 w-5 shrink-0 items-center justify-center"
              >
                <span
                  className={`h-1 w-1 rounded-full ${active ? "bg-primary" : "bg-hairline"}`}
                />
              </span>
            )}

            <Link
              href={`/assignments?category=${uuid}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 text-sm ${
                active
                  ? "font-semibold text-primary"
                  : onPath
                    ? "font-medium text-ink"
                    : "text-secondary group-hover:text-ink"
              }`}
            >
              <span className="min-w-0 flex-1 line-clamp-1">{name}</span>

              {/* What this category inherits FROM the selection. The single
                  most misread thing on this screen is that an assignment made
                  here lands on every descendant too. */}
              {inherits && (
                <span
                  title="Inherits everything assigned to the selected category"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40"
                />
              )}

              {node.category.productCount > 0 && (
                <span className="shrink-0 text-[10px] text-faint tabular-nums">
                  {node.category.productCount}
                </span>
              )}
            </Link>
          </div>

          {/* The guide is one border on the CHILD LIST, not a segment per row.
              Drawn per row it breaks at every gap and a highlighted row paints
              over its own rail — which is exactly what made this unreadable.
              As a container border it is continuous and stops at the last
              child, and it lines up under the parent's twisty. */}
          {hasChildren && expanded && (
            <div
              className={`ml-2.5 border-l pl-1.5 ${
                active || onPath ? "border-primary/30" : "border-hairline"
              }`}
            >
              <Branch
                nodes={node.children}
                selected={selected}
                ancestors={ancestors}
                descendants={descendants}
                open={open}
                onToggle={onToggle}
                filtering={filtering}
              />
            </div>
          )}
        </li>
      );
    })}
  </ul>
);

export const CategoryTree = ({ categories, selected }: CategoryTreeProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTree(categories), [categories]);
  const ancestors = useMemo(
    () => pathTo(categories, selected),
    [categories, selected],
  );
  const descendants = useMemo(
    () => subtreeOf(categories, selected),
    [categories, selected],
  );

  const term = query.trim().toLowerCase();
  const shown = useMemo(
    () => (term === "" ? tree : prune(tree, term)),
    [tree, term],
  );

  const toggle = (uuid: string): void =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });

  return (
    // Sticky and viewport-tall on a wide screen: the tree is the navigation, so
    // it stays put while the panel beside it scrolls. On a phone it is a normal
    // block that flows above the panel.
    // top-20 clears the sticky navbar; the height is the viewport minus that
    // offset and a bottom margin, so the tree ends where the page does.
    <div className="flex flex-col overflow-hidden rounded-card border border-hairline bg-surface lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-hairline px-3 py-3">
        <div className="flex items-center gap-2">
          <FolderTree size={14} className="text-faint" />
          <span className="text-xs font-semibold tracking-widest text-faint uppercase">
            Categories
          </span>
          <span className="ml-auto text-[11px] text-faint tabular-nums">
            {categories.length}
          </span>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a category…"
            className="w-full rounded-control border border-search-border bg-base py-1.5 pr-7 pl-8 text-sm text-ink outline-none transition-colors focus:border-primary"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear the search"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-control p-1 text-faint hover:text-ink"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {shown.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-faint">
            No category matches “{query}”.
          </p>
        ) : (
          <Branch
            nodes={shown}
            selected={selected}
            ancestors={ancestors}
            descendants={descendants}
            open={open}
            onToggle={toggle}
            filtering={term !== ""}
          />
        )}
      </div>

      {selected && descendants.size > 0 && (
        <p className="shrink-0 border-t border-hairline px-3 py-2.5 text-[11px] text-muted">
          {descendants.size} categor{descendants.size === 1 ? "y" : "ies"} below
          this one inherit whatever you assign here.
        </p>
      )}
    </div>
  );
};
