"use server";

import { db } from "@/db";
import { Brands, SelectBrands } from "@/db/schema/brands";
import { Categories, SelectCategories } from "@/db/schema/categories";
import { InsertProducts, Products, SelectProducts } from "@/db/schema/products";
import { generateProductSku } from "services";
import { generateUuid, slugify } from "utils";
import { asc, count, eq, getTableColumns } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ProductFields = Omit<
  InsertProducts,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type ProductClientFields = Omit<ProductFields, "slug">;

export type ProductActionResult = {
  productUuid?: string;
  error?: string;
  success?: boolean;
};

export type ProductListItem = SelectProducts & {
  categoryName: SelectCategories["name"] | null;
  brandName: SelectBrands["name"] | null;
};

export const getProducts = async (): Promise<ProductListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Products),
        categoryName: Categories.name,
        brandName: Brands.name,
      })
      .from(Products)
      .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
      .leftJoin(Brands, eq(Products.brandUuid, Brands.uuid))
      .orderBy(asc(Products.order));
  } catch {
    throw new Error("Failed to fetch products");
  }
};

export const getProduct = async (
  uuid: string,
): Promise<SelectProducts | null> => {
  try {
    const [product] = await db
      .select()
      .from(Products)
      .where(eq(Products.uuid, uuid));

    return product ?? null;
  } catch {
    throw new Error("Failed to fetch product");
  }
};

export const createProduct = async (
  _prevState: ProductActionResult,
  fields: ProductClientFields,
): Promise<ProductActionResult> => {
  const uuid = generateUuid();
  try {
    const [{ total }] = await db.select({ total: count() }).from(Products);
    // The SKU is system-owned: assembled from the brand/category/series codes,
    // never taken from the client.
    const sku = await generateProductSku({
      brandUuid: fields.brandUuid,
      categoryUuid: fields.categoryUuid,
      seriesCode: fields.seriesCode,
    });
    await db.insert(Products).values({
      ...fields,
      sku,
      uuid,
      order: total,
      slug: slugify(fields.name),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create product",
    };
  }

  revalidatePath("/products");
  redirect("/products");
};

export const updateProduct = async (
  uuid: string,
  _prevState: ProductActionResult,
  fields: ProductClientFields,
): Promise<ProductActionResult> => {
  try {
    // Regenerate the SKU (stable when brand/category/series are unchanged).
    const sku = await generateProductSku({
      brandUuid: fields.brandUuid,
      categoryUuid: fields.categoryUuid,
      seriesCode: fields.seriesCode,
      productUuid: uuid,
    });
    await db
      .update(Products)
      .set({ ...fields, sku, slug: slugify(fields.name) })
      .where(eq(Products.uuid, uuid));
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update product",
    };
  }

  revalidatePath("/products");
  redirect("/products");
};

export const deleteProduct = async (
  uuid: string,
): Promise<ProductActionResult> => {
  try {
    await db.delete(Products).where(eq(Products.uuid, uuid));
    revalidatePath("/products");
    return { success: true, productUuid: uuid };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete product",
    };
  }
};
