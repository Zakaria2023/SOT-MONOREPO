import { and, asc, eq, getTableColumns, inArray, ne } from "drizzle-orm";
import { db } from "../../../db";
import { Brands, SelectBrands } from "../../../db/schema/brands";
import { Categories, SelectCategories } from "../../../db/schema/categories";
import { Products, SelectProducts } from "../../../db/schema/products";

export type ProductListItem = SelectProducts & {
  categoryName: SelectCategories["name"] | null;
  brandName: SelectBrands["name"] | null;
};

export type ProductDetail = ProductListItem & {
  category: SelectCategories | null;
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

/** A product resolved by its slug, enriched with its category for the detail page. */
export const getProductDetailBySlug = async (
  slug: string,
): Promise<ProductDetail | null> => {
  try {
    const [product] = await db
      .select({
        ...getTableColumns(Products),
        categoryName: Categories.name,
        brandName: Brands.name,
      })
      .from(Products)
      .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
      .leftJoin(Brands, eq(Products.brandUuid, Brands.uuid))
      .where(eq(Products.slug, slug));

    if (!product) return null;

    const [category] = await db
      .select()
      .from(Categories)
      .where(eq(Categories.uuid, product.categoryUuid));

    return { ...product, category: category ?? null };
  } catch {
    throw new Error("Failed to fetch product");
  }
};

/** Other products in the same category, for the side-by-side comparison. */
export const getComparableProducts = async (
  categoryUuid: string,
  excludeProductUuid: string,
  limit = 2,
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
      .where(
        and(
          eq(Products.categoryUuid, categoryUuid),
          ne(Products.uuid, excludeProductUuid),
        ),
      )
      .orderBy(asc(Products.order))
      .limit(limit);
  } catch {
    throw new Error("Failed to fetch comparable products");
  }
};

/**
 * Products related to the given one: those in the same category, plus siblings
 * under the same parent category (and the parent itself), excluding the product.
 */
export const getRelatedProducts = async (
  productUuid: string,
  limit = 6,
): Promise<ProductListItem[]> => {
  try {
    const [product] = await db
      .select({ categoryUuid: Products.categoryUuid })
      .from(Products)
      .where(eq(Products.uuid, productUuid));
    if (!product) return [];

    const [category] = await db
      .select({ uuid: Categories.uuid, parentUuid: Categories.parentUuid })
      .from(Categories)
      .where(eq(Categories.uuid, product.categoryUuid));

    const categoryUuids = new Set<string>([product.categoryUuid]);
    if (category?.parentUuid) {
      categoryUuids.add(category.parentUuid);
      const siblings = await db
        .select({ uuid: Categories.uuid })
        .from(Categories)
        .where(eq(Categories.parentUuid, category.parentUuid));
      for (const sibling of siblings) categoryUuids.add(sibling.uuid);
    }

    return await db
      .select({
        ...getTableColumns(Products),
        categoryName: Categories.name,
        brandName: Brands.name,
      })
      .from(Products)
      .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
      .leftJoin(Brands, eq(Products.brandUuid, Brands.uuid))
      .where(
        and(
          inArray(Products.categoryUuid, [...categoryUuids]),
          ne(Products.uuid, productUuid),
        ),
      )
      .orderBy(asc(Products.order))
      .limit(limit);
  } catch {
    throw new Error("Failed to fetch related products");
  }
};
