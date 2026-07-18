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
