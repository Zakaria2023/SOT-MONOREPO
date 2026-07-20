import {
  asc,
  count,
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
import { Brands, InsertBrands, SelectBrands } from "../../../db/schema/brands";
import { Products } from "../../../db/schema/products";

export type { SelectBrands };

export type BrandListItem = SelectBrands & {
  parentName: SelectBrands["name"] | null;
  productCount: number;
};

// One column of the reorder board: a parent (null = top level) with its total
// child count and the first page of those children.
export type BrandBoardColumn = {
  parentUuid: SelectBrands["parentUuid"];
  parentName: SelectBrands["name"] | null;
  total: number;
  items: BrandListItem[];
};

export type BrandFields = Omit<
  InsertBrands,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type BrandListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

const ParentBrands = alias(Brands, "parent_brands");

// The row selection shared by every list query: the brand columns, its parent's
// name, and how many products sit directly in it.
const brandListSelection = {
  ...getTableColumns(Brands),
  parentName: ParentBrands.name,
  productCount: count(Products.id),
};

// Match a search term against the brand name or its generated code.
const brandSearchFilter = (search?: string) => {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }
  return or(like(Brands.name, `%${term}%`), like(Brands.code, `%${term}%`));
};

/** Every brand with its parent name and product count, ordered by `order`. */
export const getBrands = async (): Promise<BrandListItem[]> => {
  try {
    return await db
      .select(brandListSelection)
      .from(Brands)
      .leftJoin(ParentBrands, eq(Brands.parentUuid, ParentBrands.uuid))
      .leftJoin(Products, eq(Products.brandUuid, Brands.uuid))
      .groupBy(Brands.id)
      .orderBy(asc(Brands.order));
  } catch (error) {
    console.error("getBrands failed:", error);
    throw new Error("Failed to fetch brands", { cause: error });
  }
};

/** A searched + paginated page of brands for the admin list table. */
export const getBrandsPage = async (
  params: BrandListParams = {},
): Promise<PaginatedResult<BrandListItem>> => {
  const { page, pageSize, offset } = resolvePagination(
    params.page,
    params.pageSize,
  );
  const where = brandSearchFilter(params.search);

  try {
    const [rows, [totals]] = await Promise.all([
      db
        .select(brandListSelection)
        .from(Brands)
        .leftJoin(ParentBrands, eq(Brands.parentUuid, ParentBrands.uuid))
        .leftJoin(Products, eq(Products.brandUuid, Brands.uuid))
        .where(where)
        .groupBy(Brands.id)
        .orderBy(asc(Brands.order))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(Brands).where(where),
    ]);

    return buildPaginatedResult(rows, Number(totals?.total ?? 0), page, pageSize);
  } catch (error) {
    console.error("getBrandsPage failed:", error);
    throw new Error("Failed to fetch brands", { cause: error });
  }
};

/**
 * Every direct child of a parent brand (or the top-level brands when parentUuid
 * is null), ordered by their per-parent `order`. Unpaginated — feeds the
 * drag-and-drop reorder view, which shows all siblings at once.
 */
export const getBrandChildren = async (
  parentUuid: string | null,
): Promise<BrandListItem[]> => {
  try {
    return await db
      .select(brandListSelection)
      .from(Brands)
      .leftJoin(ParentBrands, eq(Brands.parentUuid, ParentBrands.uuid))
      .leftJoin(Products, eq(Products.brandUuid, Brands.uuid))
      .where(
        parentUuid ? eq(Brands.parentUuid, parentUuid) : isNull(Brands.parentUuid),
      )
      .groupBy(Brands.id)
      .orderBy(asc(Brands.order));
  } catch (error) {
    console.error("getBrandChildren failed:", error);
    throw new Error("Failed to fetch brand children", { cause: error });
  }
};

/**
 * One page of a parent's direct child brands (or the top-level brands when
 * parentUuid is null), ordered by their per-parent `order`. Server-side
 * pagination for the reorder board — only `pageSize` rows leave the database.
 */
export const getBrandChildrenPage = async (
  parentUuid: string | null,
  page = 0,
  pageSize = BOARD_PAGE_SIZE,
): Promise<BrandListItem[]> => {
  const offset = Math.max(0, page) * pageSize;
  try {
    return await db
      .select(brandListSelection)
      .from(Brands)
      .leftJoin(ParentBrands, eq(Brands.parentUuid, ParentBrands.uuid))
      .leftJoin(Products, eq(Products.brandUuid, Brands.uuid))
      .where(
        parentUuid
          ? eq(Brands.parentUuid, parentUuid)
          : isNull(Brands.parentUuid),
      )
      .groupBy(Brands.id)
      .orderBy(asc(Brands.order))
      .limit(pageSize)
      .offset(offset);
  } catch (error) {
    console.error("getBrandChildrenPage failed:", error);
    throw new Error("Failed to fetch brand children page", { cause: error });
  }
};

/**
 * The reorder board: the top-level column plus one column per parent that has
 * children, each with its total count and only its first page of children.
 */
export const getBrandBoard = async (
  pageSize = BOARD_PAGE_SIZE,
): Promise<BrandBoardColumn[]> => {
  const structure = await db
    .select({
      uuid: Brands.uuid,
      name: Brands.name,
      parentUuid: Brands.parentUuid,
    })
    .from(Brands)
    .orderBy(asc(Brands.order));

  const totals = new Map<string | null, number>();
  const nameOf = new Map<string, string>();
  for (const row of structure) {
    nameOf.set(row.uuid, row.name);
    const key = row.parentUuid ?? null;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

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
      items: await getBrandChildrenPage(parentUuid, 0, pageSize),
    })),
  );
};

/**
 * Reorder within one paginated column: the client sends only the reordered
 * page window, so this loads the parent's full ordered child list, splices the
 * window in at `pageStart`, and renumbers everything 0-based.
 */
export const reorderBrandChildren = async (
  parentUuid: string | null,
  pageStart: number,
  orderedPageUuids: string[],
): Promise<void> => {
  if (orderedPageUuids.length === 0) {
    return;
  }
  const rows = await db
    .select({ uuid: Brands.uuid })
    .from(Brands)
    .where(
      parentUuid ? eq(Brands.parentUuid, parentUuid) : isNull(Brands.parentUuid),
    )
    .orderBy(asc(Brands.order));

  const full = rows.map((row) => row.uuid);
  const safeStart = Math.max(0, Math.min(pageStart, full.length));
  full.splice(safeStart, orderedPageUuids.length, ...orderedPageUuids);

  await db.transaction(async (tx) => {
    for (let index = 0; index < full.length; index++) {
      await tx
        .update(Brands)
        .set({ order: index })
        .where(eq(Brands.uuid, full[index]));
    }
  });
};

export const getBrand = async (uuid: string): Promise<SelectBrands | null> => {
  try {
    const [brand] = await db.select().from(Brands).where(eq(Brands.uuid, uuid));

    return brand ?? null;
  } catch (error) {
    console.error("getBrand failed:", error);
    throw new Error("Failed to fetch brand", { cause: error });
  }
};

/** Create a brand with a system-generated unique code. Returns its uuid. */
export const createBrand = async (fields: BrandFields): Promise<string> => {
  const uuid = generateUuid();
  const existing = await db.select({ code: Brands.code }).from(Brands);
  const taken = new Set(
    existing
      .map((row) => row.code)
      .filter((code): code is string => Boolean(code)),
  );
  const code = resolveUniqueCode(deriveCode(fields.name), taken);
  await db.insert(Brands).values({ ...fields, uuid, order: existing.length, code });
  return uuid;
};

export const updateBrand = async (
  uuid: string,
  fields: BrandFields,
): Promise<void> => {
  await db.update(Brands).set(fields).where(eq(Brands.uuid, uuid));
};

export const deleteBrand = async (uuid: string): Promise<void> => {
  await db.delete(Brands).where(eq(Brands.uuid, uuid));
};

/**
 * Persist a new sibling order: each brand's `order` becomes its index in the
 * given list, scoped to the parent (0-based among its children). Atomic — a
 * mid-way failure rolls back instead of leaving a half-applied order.
 */
export const reorderBrands = async (orderedUuids: string[]): Promise<void> => {
  if (orderedUuids.length === 0) {
    return;
  }
  await db.transaction(async (tx) => {
    for (let index = 0; index < orderedUuids.length; index++) {
      await tx
        .update(Brands)
        .set({ order: index })
        .where(eq(Brands.uuid, orderedUuids[index]));
    }
  });
};
