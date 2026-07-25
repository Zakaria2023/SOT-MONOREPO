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
};

// Flatten the parent/child graph depth-first into render order, so the list can
// stay a plain <ul> and still read as a tree.
const flatten = (categories: CategoryListItem[]): TreeNode[] => {
  const childrenOf = new Map<string | null, CategoryListItem[]>();
  for (const category of categories) {
    const key = category.parentUuid ?? null;
    const list = childrenOf.get(key) ?? [];
    list.push(category);
    childrenOf.set(key, list);
  }

  const nodes: TreeNode[] = [];
  const walk = (parentUuid: string | null, depth: number) => {
    for (const category of childrenOf.get(parentUuid) ?? []) {
      nodes.push({ category, depth });
      walk(category.uuid, depth + 1);
    }
  };
  walk(null, 0);
  return nodes;
};

export const CategoryTree = ({ categories, selected }: CategoryTreeProps) => {
  const nodes = flatten(categories);

  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
      <p className="text-xs font-semibold tracking-widest text-faint uppercase">
        Category tree
      </p>

      <ul className="mt-3 flex max-h-[32rem] flex-col gap-0.5 overflow-y-auto">
        {nodes.map(({ category, depth }) => {
          const active = category.uuid === selected;
          return (
            <li key={category.uuid}>
              <Link
                href={`/assignments?category=${category.uuid}`}
                style={{ paddingLeft: 8 + depth * 16 }}
                className={
                  active
                    ? "flex items-center gap-2 rounded-lg bg-primary py-1.5 pr-2 text-sm font-semibold text-white"
                    : "flex items-center gap-2 rounded-lg py-1.5 pr-2 text-sm text-ink transition-colors hover:bg-hover"
                }
              >
                {category.path && (
                  <span
                    className={
                      active
                        ? "font-mono text-[10px] text-white/70"
                        : "font-mono text-[10px] text-faint"
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

      <p className="mt-3 border-t border-hairline pt-3 text-xs text-faint">
        Pick a category — its attributes are what it inherits, plus its own.
      </p>
    </div>
  );
};
