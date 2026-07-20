import {
  asc,
  count,
  countDistinct,
  eq,
  getTableColumns,
  isNull,
  like,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import {
  BOARD_PAGE_SIZE,
  buildPaginatedResult,
  deriveCode,
  generateUuid,
  resolvePagination,
  resolveUniqueCode,
  type PaginatedResult,
} from "utils";
import { db } from "../../../db";
import {
  Categories,
  InsertCategories,
  SelectCategories,
} from "../../../db/schema/categories";
import { Products } from "../../../db/schema/products";

export type { SelectCategories };

export type CategoryListItem = SelectCategories & {
  parentName: SelectCategories["name"] | null;
  productCount: number;
};

// A board card: a list item that also carries its own direct child count, so a
// card knows whether it can be expanded without the board ever loading any
// other column's children.
export type CategoryBoardItem = CategoryListItem & {
  childCount: number;
};

// One column of the reorder board: a parent (null = top level) with its total
// child count and the first page of those children.
export type CategoryBoardColumn = {
  parentUuid: SelectCategories["parentUuid"];
  parentName: SelectCategories["name"] | null;
  total: number;
  items: CategoryListItem[];
};

export type CategoryFields = Omit<
  InsertCategories,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type CategoryListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

const ParentCategories = alias(Categories, "parent_categories");
const ChildCategories = alias(Categories, "child_categories");

// The row selection shared by every list query: the category columns, its
// parent's name, and how many products sit directly in it.
const categoryListSelection = {
  ...getTableColumns(Categories),
  parentName: ParentCategories.name,
  productCount: count(Products.id),
};

// The board selection: adds each card's own direct child count (via a join to a
// child alias). Both counts use countDistinct so the child join and the product
// join don't multiply each other's rows.
const categoryBoardSelection = {
  ...getTableColumns(Categories),
  parentName: ParentCategories.name,
  productCount: countDistinct(Products.id),
  childCount: countDistinct(ChildCategories.id),
};

// Match a search term against the category name or its generated code.
const categorySearchFilter = (search?: string) => {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }
  return or(
    like(Categories.name, `%${term}%`),
    like(Categories.code, `%${term}%`),
  );
};

/** Every category with its parent name and product count, ordered by `order`. */
export const getCategories = async (): Promise<CategoryListItem[]> => {
  try {
    return await db
      .select(categoryListSelection)
      .from(Categories)
      .leftJoin(
        ParentCategories,
        eq(Categories.parentUuid, ParentCategories.uuid),
      )
      .leftJoin(Products, eq(Products.categoryUuid, Categories.uuid))
      .groupBy(Categories.id)
      .orderBy(asc(Categories.order));
  } catch (error) {
    console.error("getCategories failed:", error);
    throw new Error("Failed to fetch categories", { cause: error });
  }
};

/** A searched + paginated page of categories for the admin list table. */
export const getCategoriesPage = async (
  params: CategoryListParams = {},
): Promise<PaginatedResult<CategoryListItem>> => {
  const { page, pageSize, offset } = resolvePagination(
    params.page,
    params.pageSize,
  );
  const where = categorySearchFilter(params.search);

  try {
    const [rows, [totals]] = await Promise.all([
      db
        .select(categoryListSelection)
        .from(Categories)
        .leftJoin(
          ParentCategories,
          eq(Categories.parentUuid, ParentCategories.uuid),
        )
        .leftJoin(Products, eq(Products.categoryUuid, Categories.uuid))
        .where(where)
        .groupBy(Categories.id)
        .orderBy(asc(Categories.order))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(Categories).where(where),
    ]);

    return buildPaginatedResult(rows, Number(totals?.total ?? 0), page, pageSize);
  } catch (error) {
    console.error("getCategoriesPage failed:", error);
    throw new Error("Failed to fetch categories", { cause: error });
  }
};

/**
 * Every direct child of a parent (or the top-level categories when parentUuid
 * is null), ordered by their per-parent `order`. Unpaginated — feeds the
 * drag-and-drop reorder view, which shows all siblings at once.
 */
export const getCategoryChildren = async (
  parentUuid: string | null,
): Promise<CategoryBoardItem[]> => {
  try {
    return await db
      .select(categoryBoardSelection)
      .from(Categories)
      .leftJoin(
        ParentCategories,
        eq(Categories.parentUuid, ParentCategories.uuid),
      )
      .leftJoin(Products, eq(Products.categoryUuid, Categories.uuid))
      .leftJoin(
        ChildCategories,
        eq(ChildCategories.parentUuid, Categories.uuid),
      )
      .where(
        parentUuid
          ? eq(Categories.parentUuid, parentUuid)
          : isNull(Categories.parentUuid),
      )
      .groupBy(Categories.id)
      .orderBy(asc(Categories.order));
  } catch (error) {
    console.error("getCategoryChildren failed:", error);
    throw new Error("Failed to fetch category children", { cause: error });
  }
};

/**
 * One page of a parent's direct children (or the top-level categories when
 * parentUuid is null), ordered by their per-parent `order`. Server-side
 * pagination for the reorder board — only `pageSize` rows leave the database.
 */
export const getCategoryChildrenPage = async (
  parentUuid: string | null,
  page = 0,
  pageSize = BOARD_PAGE_SIZE,
): Promise<CategoryListItem[]> => {
  const offset = Math.max(0, page) * pageSize;
  try {
    return await db
      .select(categoryListSelection)
      .from(Categories)
      .leftJoin(
        ParentCategories,
        eq(Categories.parentUuid, ParentCategories.uuid),
      )
      .leftJoin(Products, eq(Products.categoryUuid, Categories.uuid))
      .where(
        parentUuid
          ? eq(Categories.parentUuid, parentUuid)
          : isNull(Categories.parentUuid),
      )
      .groupBy(Categories.id)
      .orderBy(asc(Categories.order))
      .limit(pageSize)
      .offset(offset);
  } catch (error) {
    console.error("getCategoryChildrenPage failed:", error);
    throw new Error("Failed to fetch category children page", { cause: error });
  }
};

/**
 * The reorder board: the top-level column plus one column per parent that has
 * children, each with all of its children.
 */
export const getCategoryBoard = async (): Promise<CategoryBoardColumn[]> => {
  // Lightweight structure pass (no joins) to derive the columns and per-parent
  // totals; the heavy product-count join is paginated per column below.
  const structure = await db
    .select({
      uuid: Categories.uuid,
      name: Categories.name,
      parentUuid: Categories.parentUuid,
    })
    .from(Categories)
    .orderBy(asc(Categories.order));

  const totals = new Map<string | null, number>();
  const nameOf = new Map<string, string>();
  for (const row of structure) {
    nameOf.set(row.uuid, row.name);
    const key = row.parentUuid ?? null;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  // Top level first, then every category (in order) that is itself a parent.
  const columnKeys: (string | null)[] = [null];
  for (const row of structure) {
    if (totals.has(row.uuid)) {
      columnKeys.push(row.uuid);
    }
  }

  return Promise.all(
    columnKeys.map(async (parentUuid) => ({
      parentUuid,
      parentName: parentUuid ? (nameOf.get(parentUuid) ?? null) : null,
      total: totals.get(parentUuid) ?? 0,
      items: await getCategoryChildren(parentUuid),
    })),
  );
};

/**
 * Reorder within one paginated column: the client sends only the reordered
 * page window, so this loads the parent's full ordered child list, splices the
 * window in at `pageStart`, and renumbers everything 0-based. Keeps the order
 * consistent across pages without shipping the whole list to the client.
 */
export const reorderCategoryChildren = async (
  parentUuid: string | null,
  pageStart: number,
  orderedPageUuids: string[],
): Promise<void> => {
  if (orderedPageUuids.length === 0) {
    return;
  }
  const rows = await db
    .select({ uuid: Categories.uuid })
    .from(Categories)
    .where(
      parentUuid
        ? eq(Categories.parentUuid, parentUuid)
        : isNull(Categories.parentUuid),
    )
    .orderBy(asc(Categories.order));

  const full = rows.map((row) => row.uuid);
  const safeStart = Math.max(0, Math.min(pageStart, full.length));
  full.splice(safeStart, orderedPageUuids.length, ...orderedPageUuids);

  await db.transaction(async (tx) => {
    for (let index = 0; index < full.length; index++) {
      await tx
        .update(Categories)
        .set({ order: index })
        .where(eq(Categories.uuid, full[index]));
    }
  });
};

/**
 * Move a category under a new parent (null = top level) and place it at
 * `targetIndex` among that parent's children. Rejects a move that would create
 * a cycle (dropping a category into one of its own descendants). Renumbers the
 * target parent's children 0-based so the paginated board stays consistent.
 */
export const moveCategoryToParent = async (
  uuid: string,
  newParentUuid: string | null,
  targetIndex: number,
): Promise<void> => {
  if (newParentUuid === uuid) {
    throw new Error("A category can't be its own parent.");
  }

  // Cycle guard: walk up from the target parent — if we reach the moved
  // category, the target is inside its own subtree.
  if (newParentUuid) {
    const all = await db
      .select({ uuid: Categories.uuid, parentUuid: Categories.parentUuid })
      .from(Categories);
    const parentOf = new Map(all.map((row) => [row.uuid, row.parentUuid]));
    let cursor: string | null = newParentUuid;
    while (cursor) {
      if (cursor === uuid) {
        throw new Error(
          "Can't move a category into one of its own subcategories.",
        );
      }
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  await db
    .update(Categories)
    .set({ parentUuid: newParentUuid })
    .where(eq(Categories.uuid, uuid));

  const rows = await db
    .select({ uuid: Categories.uuid })
    .from(Categories)
    .where(
      newParentUuid
        ? eq(Categories.parentUuid, newParentUuid)
        : isNull(Categories.parentUuid),
    )
    .orderBy(asc(Categories.order));

  const ordered = rows.map((row) => row.uuid).filter((id) => id !== uuid);
  const index = Math.max(0, Math.min(targetIndex, ordered.length));
  ordered.splice(index, 0, uuid);

  await db.transaction(async (tx) => {
    for (let i = 0; i < ordered.length; i++) {
      await tx
        .update(Categories)
        .set({ order: i })
        .where(eq(Categories.uuid, ordered[i]));
    }
  });
};

export const getCategory = async (
  uuid: string,
): Promise<SelectCategories | null> => {
  try {
    const [category] = await db
      .select()
      .from(Categories)
      .where(eq(Categories.uuid, uuid));

    return category ?? null;
  } catch (error) {
    console.error("getCategory failed:", error);
    throw new Error("Failed to fetch category", { cause: error });
  }
};

/** Create a category with a system-generated unique code. Returns its uuid. */
export const createCategory = async (
  fields: CategoryFields,
): Promise<string> => {
  const uuid = generateUuid();
  const existing = await db.select({ code: Categories.code }).from(Categories);
  const taken = new Set(
    existing
      .map((row) => row.code)
      .filter((code): code is string => Boolean(code)),
  );
  const code = resolveUniqueCode(deriveCode(fields.name), taken);
  await db
    .insert(Categories)
    .values({ ...fields, uuid, order: existing.length, code });
  return uuid;
};

export const updateCategory = async (
  uuid: string,
  fields: CategoryFields,
): Promise<void> => {
  await db.update(Categories).set(fields).where(eq(Categories.uuid, uuid));
};

export const deleteCategory = async (uuid: string): Promise<void> => {
  // `Products.categoryUuid` references this row with onDelete: "restrict", so a
  // raw delete throws an opaque foreign-key error when products still point
  // here. Check dependents first and surface a clear, actionable message. Child
  // categories use onDelete: "set null" (they survive, orphaned to top level),
  // but blocking on them too keeps the tree from silently reshaping.
  const [productDep] = await db
    .select({ value: count() })
    .from(Products)
    .where(eq(Products.categoryUuid, uuid));
  const productCount = productDep?.value ?? 0;
  if (productCount > 0) {
    throw new Error(
      `This category still has ${productCount} ${
        productCount === 1 ? "product" : "products"
      }. Move or delete them before deleting the category.`,
    );
  }

  const [childDep] = await db
    .select({ value: count() })
    .from(Categories)
    .where(eq(Categories.parentUuid, uuid));
  const childCount = childDep?.value ?? 0;
  if (childCount > 0) {
    throw new Error(
      `This category has ${childCount} ${
        childCount === 1 ? "subcategory" : "subcategories"
      }. Move or delete them before deleting the category.`,
    );
  }

  await db.delete(Categories).where(eq(Categories.uuid, uuid));
};

/**
 * Persist a new sibling order: each category's `order` becomes its index in the
 * given list, scoped to the parent (0-based among its children). Atomic — a
 * mid-way failure rolls back instead of leaving a half-applied order.
 */
export const reorderCategories = async (
  orderedUuids: string[],
): Promise<void> => {
  if (orderedUuids.length === 0) {
    return;
  }
  await db.transaction(async (tx) => {
    for (let index = 0; index < orderedUuids.length; index++) {
      await tx
        .update(Categories)
        .set({ order: index })
        .where(eq(Categories.uuid, orderedUuids[index]));
    }
  });
};
