import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  like,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
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

export type ProductSort = "featured" | "price-asc" | "price-desc" | "name";

export type ProductFilters = {
  /** Case-insensitive match against product name or brand name. */
  search?: string;
  /** Restrict to these category uuids (pass a whole subtree to include children). */
  categoryUuids?: string[];
  /** Restrict to these brand uuids (pass a whole subtree to include children). */
  brandUuids?: string[];
  /** Column ordering applied in SQL. */
  sort?: ProductSort;
};

// SQL ordering for each sort option.
const productOrder = (sort: ProductSort | undefined) => {
  switch (sort) {
    case "price-asc":
      return [asc(Products.price)];
    case "price-desc":
      return [desc(Products.price)];
    case "name":
      return [asc(Products.name)];
    default:
      return [desc(Products.isFeatured), asc(Products.order)];
  }
};

export const getProducts = async (
  filters: ProductFilters = {},
): Promise<ProductListItem[]> => {
  try {
    const conditions: (SQL | undefined)[] = [];
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(or(like(Products.name, term), like(Brands.name, term)));
    }
    if (filters.categoryUuids && filters.categoryUuids.length > 0) {
      conditions.push(inArray(Products.categoryUuid, filters.categoryUuids));
    }
    if (filters.brandUuids && filters.brandUuids.length > 0) {
      conditions.push(inArray(Products.brandUuid, filters.brandUuids));
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(...productOrder(filters.sort));
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

export const getProductsByBrand = async (
  brandUuid: string,
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
      .where(eq(Products.brandUuid, brandUuid))
      .orderBy(asc(Products.order));
  } catch {
    throw new Error("Failed to fetch products for brand");
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
