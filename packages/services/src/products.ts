import { asc, eq, getTableColumns } from "drizzle-orm";
import { db } from "../../../db";
import { Brands, SelectBrands } from "../../../db/schema/brands";
import { Categories, SelectCategories } from "../../../db/schema/categories";
import { Products, SelectProducts } from "../../../db/schema/products";

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

export const getProductsByCategory = async (
  categoryUuid: string,
): Promise<ProductListItem[]> => {
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
      .where(eq(Products.categoryUuid, categoryUuid))
      .orderBy(asc(Products.order));
  } catch {
    throw new Error("Failed to fetch products for category");
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
