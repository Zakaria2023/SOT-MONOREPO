"use server";

import { db } from "@/db";
import { Brands, InsertBrands, SelectBrands } from "@/db/schema/brands";
import { generateUuid } from "utils";
import { asc, count, eq, getTableColumns } from "drizzle-orm";
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

const ParentBrands = alias(Brands, "parent_brands");

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
  } catch {
    throw new Error("Failed to fetch brands");
  }
};

export const getBrand = async (
  uuid: string,
): Promise<SelectBrands | null> => {
  try {
    const [brand] = await db.select().from(Brands).where(eq(Brands.uuid, uuid));

    return brand ?? null;
  } catch {
    throw new Error("Failed to fetch brand");
  }
};

export const createBrand = async (
  _prevState: BrandActionResult,
  fields: BrandFields,
): Promise<BrandActionResult> => {
  const uuid = generateUuid();
  try {
    const [{ total }] = await db.select({ total: count() }).from(Brands);
    await db.insert(Brands).values({ ...fields, uuid, order: total });
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
