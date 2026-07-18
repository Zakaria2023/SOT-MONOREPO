"use server";

import { db } from "@/db";
import { Brands, InsertBrands, SelectBrands } from "@/db/schema/brands";
import type { PaginatedResult } from "utils";
import {
  buildPaginatedResult,
  deriveCode,
  generateUuid,
  resolvePagination,
  resolveUniqueCode,
} from "utils";
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
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type BrandFields = Omit<
  InsertBrands,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type BrandActionResult = {
  brandUuid?: string;
  error?: string;
  success?: boolean;
};

export type BrandListItem = SelectBrands & {
  parentName: SelectBrands["name"] | null;
};

export type BrandListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

const ParentBrands = alias(Brands, "parent_brands");

// Match a search term against the brand name or its generated code.
const brandSearchFilter = (search?: string) => {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }
  return or(like(Brands.name, `%${term}%`), like(Brands.code, `%${term}%`));
};

// Full, unpaginated list — used to populate the parent-brand dropdowns on the
// brand/product forms, which need every brand.
export const getBrands = async (): Promise<BrandListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Brands),
        parentName: ParentBrands.name,
      })
      .from(Brands)
      .leftJoin(ParentBrands, eq(Brands.parentUuid, ParentBrands.uuid))
      .orderBy(asc(Brands.order));
  } catch (error) {
    console.error("getBrands failed:", error);
    throw new Error("Failed to fetch brands", { cause: error });
  }
};

// Searched + paginated page of brands for the list table. The frontend drives
// `search`/`page` through URL search params.
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
        .select({
          ...getTableColumns(Brands),
          parentName: ParentBrands.name,
        })
        .from(Brands)
        .leftJoin(ParentBrands, eq(Brands.parentUuid, ParentBrands.uuid))
        .where(where)
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

// Every direct child of a parent brand (or the top-level brands when parentUuid
// is null), ordered by their per-parent `order`. Unpaginated — feeds the
// drag-and-drop reorder view, which shows all siblings at once.
export const getBrandChildren = async (
  parentUuid: string | null,
): Promise<BrandListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Brands),
        parentName: ParentBrands.name,
      })
      .from(Brands)
      .leftJoin(ParentBrands, eq(Brands.parentUuid, ParentBrands.uuid))
      .where(
        parentUuid ? eq(Brands.parentUuid, parentUuid) : isNull(Brands.parentUuid),
      )
      .orderBy(asc(Brands.order));
  } catch (error) {
    console.error("getBrandChildren failed:", error);
    throw new Error("Failed to fetch brand children", { cause: error });
  }
};

// Persist a new sibling order: each brand's `order` becomes its index in the
// given list. Scoped to the parent (0-based among its children) — it does not
// touch brands under any other parent.
export const reorderBrands = async (
  orderedUuids: string[],
): Promise<{ error?: string }> => {
  try {
    await Promise.all(
      orderedUuids.map((uuid, index) =>
        db.update(Brands).set({ order: index }).where(eq(Brands.uuid, uuid)),
      ),
    );
    revalidatePath("/brands");
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to reorder brands",
    };
  }
};

export const getBrand = async (
  uuid: string,
): Promise<SelectBrands | null> => {
  try {
    const [brand] = await db.select().from(Brands).where(eq(Brands.uuid, uuid));

    return brand ?? null;
  } catch (error) {
    console.error("getBrand failed:", error);
    throw new Error("Failed to fetch brand", { cause: error });
  }
};

export const createBrand = async (
  _prevState: BrandActionResult,
  fields: BrandFields,
): Promise<BrandActionResult> => {
  const uuid = generateUuid();
  try {
    const existing = await db.select({ code: Brands.code }).from(Brands);
    const taken = new Set(
      existing.map((row) => row.code).filter((code): code is string =>
        Boolean(code),
      ),
    );
    const code = resolveUniqueCode(deriveCode(fields.name), taken);
    await db
      .insert(Brands)
      .values({ ...fields, uuid, order: existing.length, code });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create brand",
    };
  }

  revalidatePath("/brands");
  redirect("/brands");
};

export const updateBrand = async (
  uuid: string,
  _prevState: BrandActionResult,
  fields: BrandFields,
): Promise<BrandActionResult> => {
  try {
    await db.update(Brands).set(fields).where(eq(Brands.uuid, uuid));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update brand",
    };
  }

  revalidatePath("/brands");
  redirect("/brands");
};

export const deleteBrand = async (
  uuid: string,
): Promise<BrandActionResult> => {
  try {
    await db.delete(Brands).where(eq(Brands.uuid, uuid));
    revalidatePath("/brands");
    return { success: true, brandUuid: uuid };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete brand",
    };
  }
};
