/**
 * Parent/child trees for the flat lists the API returns.
 *
 * Categories and brands both arrive as flat arrays carrying `parentUuid`, and both
 * the catalogue filters and the categories screen need the same three things from
 * them: the shape, a count that includes everything underneath, and the uuids of a
 * whole subtree. This is the mobile twin of the web client's `lib/catalog.ts`, kept
 * to the same rules so the two surfaces cannot disagree about what "Networking (12)"
 * means.
 */

export type FlatNode = {
  uuid: string;
  parentUuid?: string | null;
};

export type TreeNode<T extends FlatNode> = T & {
  children: TreeNode<T>[];
  /** This node's own products plus every descendant's. */
  count: number;
};

/**
 * Build the tree, rolling each node's count up through its descendants.
 *
 * A parent category holds no products of its own in this catalogue — they sit in
 * the leaves — so a parent showing its direct count would read "0" beside a family
 * with forty products under it.
 *
 * An item whose parent is missing from the list becomes a root rather than
 * disappearing: a child whose parent was filtered out is still a category, and
 * dropping it would silently shorten the screen.
 */
export const buildTree = <T extends FlatNode>(
  items: T[],
  directCount: (item: T) => number,
): TreeNode<T>[] => {
  const nodes = new Map<string, TreeNode<T>>();
  for (const item of items) {
    nodes.set(item.uuid, { ...item, children: [], count: directCount(item) });
  }

  const roots: TreeNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentUuid ? nodes.get(node.parentUuid) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const seen = new Set<string>();
  const rollUp = (node: TreeNode<T>): number => {
    // Guards a cycle in bad parent data, which would otherwise recurse forever.
    if (seen.has(node.uuid)) {
      return 0;
    }
    seen.add(node.uuid);
    for (const child of node.children) {
      node.count += rollUp(child);
    }
    return node.count;
  };
  roots.forEach(rollUp);

  return roots;
};

/** A node's uuid plus every descendant's. */
export const subtreeUuids = <T extends FlatNode>(
  node: TreeNode<T>,
): string[] => [node.uuid, ...node.children.flatMap(subtreeUuids)];

/** Every node's subtree, keyed by uuid — one walk instead of one per lookup. */
export const subtreeMap = <T extends FlatNode>(
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

/** Find a node anywhere in the tree. */
export const findNode = <T extends FlatNode>(
  roots: TreeNode<T>[],
  uuid: string,
): TreeNode<T> | null => {
  for (const node of roots) {
    if (node.uuid === uuid) {
      return node;
    }
    const found = findNode(node.children, uuid);
    if (found) {
      return found;
    }
  }
  return null;
};
