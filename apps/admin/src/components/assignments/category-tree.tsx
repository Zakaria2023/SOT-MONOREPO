import type { CategoryListItem } from "services";
import Link from "next/link";

type CategoryTreeProps = {
  categories: CategoryListItem[];
  // uuid of the selected category, or null before anything is picked.
  selected: string | null;
};

type TreeNode = {
  category: CategoryListItem;
  depth: number;
  // Whether this node is the last child of its parent — decides an elbow (└)
  // rather than a tee (├).
  isLast: boolean;
  // For each ancestor level, whether that ancestor still has siblings below it.
  // A continuing line is drawn only where it does, so the guides trace the
  // actual path back to the root instead of a solid grid.
  ancestorLines: boolean[];
};

// Flatten the parent/child graph depth-first into render order, carrying the
// guide-line state each row needs to draw its own connectors.
const flatten = (categories: CategoryListItem[]): TreeNode[] => {
  const childrenOf = new Map<string | null, CategoryListItem[]>();
  for (const category of categories) {
    const key = category.parentUuid ?? null;
    const list = childrenOf.get(key) ?? [];
    list.push(category);
    childrenOf.set(key, list);
  }

  const nodes: TreeNode[] = [];
  const walk = (
    parentUuid: string | null,
    depth: number,
    ancestorLines: boolean[],
  ) => {
    const siblings = childrenOf.get(parentUuid) ?? [];
    siblings.forEach((category, index) => {
      const isLast = index === siblings.length - 1;
      nodes.push({ category, depth, isLast, ancestorLines });
      walk(category.uuid, depth + 1, [...ancestorLines, !isLast]);
    });
  };
  walk(null, 0, []);
  return nodes;
};

export const CategoryTree = ({ categories, selected }: CategoryTreeProps) => {
  const nodes = flatten(categories);

  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
      <p className="text-xs font-semibold tracking-widest text-faint uppercase">
        Category tree
      </p>

      <ul className="scrollbar-slim mt-3 flex max-h-136 flex-col overflow-y-auto pr-1">
        {nodes.map(({ category, depth, isLast, ancestorLines }) => {
          const active = category.uuid === selected;
          return (
            // The guides sit OUTSIDE the link, so a selected row's highlight
            // never paints over the lines leading to it.
            <li key={category.uuid} className="flex items-stretch">
              {/* One column per ancestor level: a vertical line only where
                  that ancestor still has siblings coming after it. */}
              {ancestorLines.map((continues, level) => (
                <span key={level} aria-hidden className="relative w-5 shrink-0">
                  {continues && (
                    <span className="absolute inset-y-0 left-1/2 w-px bg-faint/45" />
                  )}
                </span>
              ))}

              {/* This node's own connector: a tee or an elbow into the label,
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

              <Link
                href={`/assignments?category=${category.uuid}`}
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
                <span className="line-clamp-1">{category.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t border-hairline pt-3 text-sm text-faint">
        Pick a category — its attributes are what it inherits, plus its own.
      </p>
    </div>
  );
};
