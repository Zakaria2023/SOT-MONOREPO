// The category tree, as pure functions. No database — the rows are handed in.
//
// Kept separate from the model loader so it can be tested without credentials,
// and so the resolution logic cannot quietly grow a query inside it. Resolving a
// category chain must never cost a round trip: the loader reads every category
// once and this walks the result in memory.

export type CategoryNode = {
  uuid: string;
  parentUuid: string | null;
};

/**
 * Nearest-first ancestor chain for every category.
 *
 * `[leaf, parent, …, root]` — the order `resolveAssignments` expects, because the
 * first row it finds for an attribute wins and that has to be the closest one.
 *
 * Bounded by the number of categories, so a parent cycle introduced by bad data
 * cannot hang a request. A tree is data, and data can be wrong.
 */
export const buildChains = (
  rows: CategoryNode[],
): Map<string, string[]> => {
  const parentOf = new Map(rows.map((row) => [row.uuid, row.parentUuid]));
  const chains = new Map<string, string[]>();

  for (const row of rows) {
    const chain: string[] = [];
    const seen = new Set<string>();
    let current: string | null = row.uuid;

    while (current && !seen.has(current) && chain.length <= rows.length) {
      chain.push(current);
      seen.add(current);
      current = parentOf.get(current) ?? null;
    }
    chains.set(row.uuid, chain);
  }
  return chains;
};

/** Every descendant of a category, including itself. */
export const subtreeUuids = (
  rows: CategoryNode[],
  rootUuid: string,
): string[] => {
  const childrenOf = new Map<string | null, string[]>();
  for (const row of rows) {
    const list = childrenOf.get(row.parentUuid) ?? [];
    list.push(row.uuid);
    childrenOf.set(row.parentUuid, list);
  }

  const collected: string[] = [];
  const seen = new Set<string>();
  const stack = [rootUuid];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) {
      continue;
    }
    seen.add(current);
    collected.push(current);
    stack.push(...(childrenOf.get(current) ?? []));
  }
  return collected;
};
