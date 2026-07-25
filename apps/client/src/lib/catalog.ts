import type { ProductSort } from "services";

export type TreeNode<T> = T & {
  children: TreeNode<T>[];
  count: number;
};

type FlatItem = {
  uuid: string;
  parentUuid: string | null;
};

// Build a parent/child tree, rolling each node's count up to include its whole
// subtree so a parent shows the total across all of its descendants.
export const buildTree = <T extends FlatItem>(
  items: T[],
  directCounts: Map<string, number>,
): TreeNode<T>[] => {
  const nodes = new Map<string, TreeNode<T>>();
  for (const item of items) {
    nodes.set(item.uuid, {
      ...item,
      children: [],
      count: directCounts.get(item.uuid) ?? 0,
    });
  }

  const roots: TreeNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentUuid ? nodes.get(node.parentUuid) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const rollUp = (node: TreeNode<T>): number => {
    for (const child of node.children) {
      node.count += rollUp(child);
    }
    return node.count;
  };
  roots.forEach(rollUp);

  return roots;
};

// A node's uuid plus every descendant uuid — used to filter by a whole subtree.
const subtreeUuids = <T extends FlatItem>(node: TreeNode<T>): string[] => [
  node.uuid,
  ...node.children.flatMap(subtreeUuids),
];

export const subtreeMap = <T extends FlatItem>(
  roots: TreeNode<T>[],
): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const walk = (node: TreeNode<T>) => {
    map.set(node.uuid, subtreeUuids(node));
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  return map;
};

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name", label: "Name A–Z" },
];

const SORT_KEYS: ProductSort[] = ["featured", "price-asc", "price-desc", "name"];

// Coerce an untrusted `sort` search-param value to a known sort key.
export const normalizeSort = (value: string | undefined): ProductSort =>
  value && SORT_KEYS.includes(value as ProductSort)
    ? (value as ProductSort)
    : "featured";

// Spec facet selections travel in the URL as repeated `spec=key:value` params
// (e.g. ?spec=cable-grade:Cat6&spec=cable-grade:Cat6a&spec=color:Black). Spec
// keys are slugified and never contain a colon, so the first colon separates
// the two halves and the value may contain its own.
export const SPEC_PARAM = "spec";

export const encodeSpecParam = (key: string, value: string): string =>
  `${key}:${value}`;

/** Parse repeated `spec` params into the map getProducts filters by. */
export const parseSpecParams = (
  values: string | string[] | undefined,
): Record<string, string[]> => {
  const raw = values === undefined ? [] : [values].flat();
  const parsed: Record<string, string[]> = {};

  for (const entry of raw) {
    const separator = entry.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (!value) {
      continue;
    }
    const current = parsed[key] ?? [];
    if (!current.includes(value)) {
      current.push(value);
    }
    parsed[key] = current;
  }
  return parsed;
};
