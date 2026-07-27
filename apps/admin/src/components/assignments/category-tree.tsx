"use client";

import { ChevronRight, FolderTree, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CategoryListItem } from "services";

// ---------------------------------------------------------------------------
// The category tree — the navigation for this whole screen, so it takes the
// full height of the viewport rather than scrolling a hundred rows through a
// short box.
//
// The guides are drawn as real connectors: a tee (├) where the parent still has
// siblings coming after it, an elbow (└) on the last child. That is what makes
// a deep branch readable — a plain indent leaves you counting pixels.
//
// One thing it must never hide: inheritance runs DOWN. What is assigned to
// Switch reaches SOHO, SMB and Industrial whether or not anyone opens them — so
// the descendants of the selection are marked right where the author chooses.
// ---------------------------------------------------------------------------

type CategoryTreeProps = {
  categories: CategoryListItem[];
  // uuid of the selected category, or null before anything is picked.
  selected: string | null;
};

type TreeRow = {
  category: CategoryListItem;
  depth: number;
  // Whether this node is the last child of its parent — decides an elbow (└)
  // rather than a tee (├).
  isLast: boolean;
  // For each ancestor level, whether that ancestor still has siblings below it.
  // A continuing line is drawn only where it does, so the guides trace the
  // actual path back to the root instead of a solid grid.
  ancestorLines: boolean[];
  hasChildren: boolean;
  expanded: boolean;
};

/**
 * Flatten the parent/child graph into render order, carrying the guide-line
 * state each row needs to draw its own connectors.
 *
 * Collapse-aware: a collapsed node's subtree is never walked, so it costs
 * nothing to keep a large tree mostly closed.
 */
const flatten = (
  categories: CategoryListItem[],
  isExpanded: (uuid: string) => boolean,
): TreeRow[] => {
  const childrenOf = new Map<string | null, CategoryListItem[]>();
  for (const category of categories) {
    const key = category.parentUuid ?? null;
    const list = childrenOf.get(key) ?? [];
    list.push(category);
    childrenOf.set(key, list);
  }

  const rows: TreeRow[] = [];
  const walk = (
    parentUuid: string | null,
    depth: number,
    ancestorLines: boolean[],
  ): void => {
    const siblings = childrenOf.get(parentUuid) ?? [];
    siblings.forEach((category, index) => {
      const isLast = index === siblings.length - 1;
      const hasChildren = (childrenOf.get(category.uuid) ?? []).length > 0;
      const expanded = hasChildren && isExpanded(category.uuid);
      rows.push({
        category,
        depth,
        isLast,
        ancestorLines,
        hasChildren,
        expanded,
      });
      if (expanded) {
        walk(category.uuid, depth + 1, [...ancestorLines, !isLast]);
      }
    });
  };
  walk(null, 0, []);
  return rows;
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
 * Categories to keep while searching: the matches, plus the ancestors that lead
 * to them. A match deep in a branch is useless without the branch it sits in.
 */
const matchesFor = (
  categories: CategoryListItem[],
  term: string,
): Set<string> => {
  const byUuid = new Map(categories.map((entry) => [entry.uuid, entry]));
  const keep = new Set<string>();
  for (const category of categories) {
    if (!category.name.toLowerCase().includes(term)) {
      continue;
    }
    keep.add(category.uuid);
    const seen = new Set<string>();
    let parent = category.parentUuid ?? null;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      keep.add(parent);
      parent = byUuid.get(parent)?.parentUuid ?? null;
    }
  }
  return keep;
};

export const CategoryTree = ({ categories, selected }: CategoryTreeProps) => {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const ancestors = useMemo(
    () => pathTo(categories, selected),
    [categories, selected],
  );
  const descendants = useMemo(
    () => subtreeOf(categories, selected),
    [categories, selected],
  );

  const term = query.trim().toLowerCase();
  const shown = useMemo(() => {
    if (term === "") {
      return categories;
    }
    // Computed once, not once per row — the set is the whole point.
    const keep = matchesFor(categories, term);
    return categories.filter((category) => keep.has(category.uuid));
  }, [categories, term]);

  // Open by default, so the shape of the catalog is visible on arrival and a
  // node is only hidden because somebody closed it. While searching everything
  // stays open, and the path to the selection is never closed — otherwise the
  // highlighted row could be somewhere you cannot see.
  const rows = useMemo(
    () =>
      flatten(
        shown,
        (uuid) => term !== "" || ancestors.has(uuid) || !collapsed.has(uuid),
      ),
    [shown, term, ancestors, collapsed],
  );

  const toggle = (uuid: string): void =>
    setCollapsed((current) => {
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
    // it stays put while the panel beside it scrolls. top-20 clears the sticky
    // navbar, and the height is the viewport minus that offset and a bottom
    // margin, so the tree ends where the page does. On a phone it is a normal
    // block that flows above the panel.
    <div className="flex flex-col overflow-hidden rounded-card border border-hairline bg-surface lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-hairline px-3 py-3">
        <div className="flex items-center gap-2">
          <FolderTree size={14} className="text-faint" />
          <span className="text-xs font-semibold tracking-widest text-faint uppercase">
            Category tree
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

      <ul className="scrollbar-slim flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2">
        {rows.length === 0 && (
          <li className="px-2 py-8 text-center text-xs text-faint">
            No category matches “{query}”.
          </li>
        )}

        {rows.map(
          ({
            category,
            depth,
            isLast,
            ancestorLines,
            hasChildren,
            expanded,
          }) => {
            const active = category.uuid === selected;
            const inherits = descendants.has(category.uuid);
            return (
              // The guides sit OUTSIDE the link, so a selected row's highlight
              // never paints over the lines leading to it.
              <li key={category.uuid} className="flex items-stretch">
                {/* One column per ancestor level: a vertical line only where
                    that ancestor still has siblings coming after it. */}
                {ancestorLines.map((continues, level) => (
                  <span
                    key={level}
                    aria-hidden
                    className="relative w-5 shrink-0"
                  >
                    {continues && (
                      <span className="absolute inset-y-0 left-1/2 w-px bg-faint/45" />
                    )}
                  </span>
                ))}

                {/* This node's own connector: a tee or an elbow into the row,
                    with a node dot where they meet. */}
                {depth > 0 && (
                  <span aria-hidden className="relative w-5 shrink-0">
                    <span
                      className={
                        isLast
                          ? "absolute top-0 left-1/2 h-1/2 w-px bg-faint/45"
                          : "absolute inset-y-0 left-1/2 w-px bg-faint/45"
                      }
                    />
                    <span className="absolute top-1/2 right-1 left-1/2 h-px bg-faint/45" />
                    <span
                      className={
                        active
                          ? "absolute top-1/2 right-0.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
                          : "absolute top-1/2 right-0.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-faint/60"
                      }
                    />
                  </span>
                )}

                {/* The twisty gets its own column so every label in a level
                    starts on the same x, whether or not the node has children.
                    It sits outside the link — collapsing a branch must not
                    navigate to it. */}
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggle(category.uuid)}
                    aria-label={
                      expanded
                        ? `Collapse ${category.name}`
                        : `Expand ${category.name}`
                    }
                    aria-expanded={expanded}
                    className="my-0.5 flex w-5 shrink-0 items-center justify-center rounded text-faint hover:text-ink"
                  >
                    <ChevronRight
                      size={13}
                      className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                    />
                  </button>
                ) : (
                  <span aria-hidden className="w-5 shrink-0" />
                )}

                <Link
                  href={`/assignments?category=${category.uuid}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "my-0.5 flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-primary px-2.5 py-2 text-base font-semibold text-white"
                      : "my-0.5 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-base text-ink transition-colors hover:bg-hover"
                  }
                >
                  {category.path && (
                    <span
                      className={
                        active
                          ? "font-mono text-xs text-white/70"
                          : "font-mono text-xs text-faint"
                      }
                    >
                      {category.path}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 line-clamp-1">
                    {category.name}
                  </span>

                  {/* What this category inherits FROM the selection — the
                      single most misread thing on this screen is that an
                      assignment made here lands on every descendant too. */}
                  {inherits && (
                    <span
                      title="Inherits everything assigned to the selected category"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40"
                    />
                  )}
                </Link>
              </li>
            );
          },
        )}
      </ul>

      <p className="shrink-0 border-t border-hairline px-3 py-2.5 text-sm text-faint">
        {selected && descendants.size > 0
          ? `${descendants.size} categor${descendants.size === 1 ? "y" : "ies"} below this one inherit whatever you assign here.`
          : "Pick a category — its attributes are what it inherits, plus its own."}
      </p>
    </div>
  );
};
