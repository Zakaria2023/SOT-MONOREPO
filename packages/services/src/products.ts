import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  like,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  buildPaginatedResult,
  generateUuid,
  resolvePagination,
  slugify,
  type PaginatedResult,
} from "utils";
import { db } from "../../../db";
import { Brands, SelectBrands } from "../../../db/schema/brands";
import { Categories, SelectCategories } from "../../../db/schema/categories";
import {
  InsertProducts,
  Products,
  SelectProducts,
} from "../../../db/schema/products";
import { normalizeProductValues } from "./product-completeness";

export type { SelectProducts };

export type ProductListItem = SelectProducts & {
  categoryName: SelectCategories["name"] | null;
  brandName: SelectBrands["name"] | null;
};

export type ProductFields = Omit<
  InsertProducts,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

// The client form never sets the slug — it's derived from the name on save.
export type ProductClientFields = Omit<ProductFields, "slug">;

export type ProductListParams = {
  search?: string;
  page?: number | string;
  pageSize?: number | string;
};

export type ProductDetail = ProductListItem & {
  category: SelectCategories | null;
  brandBusinessLines: SelectBrands["businessLines"];
};

export type ProductSort = "featured" | "price-asc" | "price-desc" | "name";

export type ProductFilters = {
  /** Case-insensitive match against product name or brand name. */
  search?: string;
  /** Restrict to these category uuids (pass a whole subtree to include children). */
  categoryUuids?: string[];
  /** Restrict to these brand uuids (pass a whole subtree to include children). */
  brandUuids?: string[];
  /**
   * Specification facet selections, keyed by the attribute's spec key. Values
   * within one key are OR'd (Cat6 or Cat6a) and the keys are AND'd (Cat6 AND
   * black), which is what a shopper means by ticking several boxes.
   */
  specValues?: Record<string, string[]>;
  /** Column ordering applied in SQL. */
  sort?: ProductSort;
};

/**
 * Match one spec facet against a product's `specValues` JSON.
 *
 * Keyed by attribute uuid, and the stored value is TYPED — a single-select is a
 * JSON string, a multi-select a JSON array. `json_contains` handles both: it
 * matches an array element, and on a scalar it compares the value itself. That is
 * why the values are typed rather than comma-joined — the old encoding needed
 * string surgery here and broke on any option containing a comma.
 */
const specValueCondition = (
  attrUuid: string,
  values: string[],
): SQL | undefined => {
  const wanted = values.filter((value) => value.trim().length > 0);
  if (wanted.length === 0) {
    return undefined;
  }
  const path = `$."${attrUuid}"`;
  return or(
    ...wanted.map(
      (value) =>
        sql`json_contains(json_extract(${Products.specValues}, ${path}), json_quote(${value}))`,
    ),
  );
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
      return [asc(Products.order)];
  }
};

/**
 * Assemble the smart SKU: `[BRAND-LINE][CATEGORY][SERIES]-[SEQ]`.
 * The KEYSPECS segment is reserved for when the structured spec template lands.
 * Returns null when the brand or category has no code yet — nothing to assemble,
 * so the product simply keeps a null SKU until the codes are set.
 */
export const generateProductSku = async (input: {
  brandUuid: string;
  categoryUuid: string;
  seriesCode?: string | null;
  productUuid?: string;
}): Promise<string | null> => {
  const [[brand], [category]] = await Promise.all([
    db
      .select({ code: Brands.code })
      .from(Brands)
      .where(eq(Brands.uuid, input.brandUuid)),
    db
      .select({ code: Categories.code })
      .from(Categories)
      .where(eq(Categories.uuid, input.categoryUuid)),
  ]);

  const brandCode = (brand?.code ?? "").toUpperCase();
  const categoryCode = (category?.code ?? "").toUpperCase();
  if (!brandCode || !categoryCode) {
    return null;
  }

  const series = (input.seriesCode ?? "").toUpperCase();
  const prefix = `${brandCode}${categoryCode}${series}`;

  // Keep the code stable across edits when the prefix hasn't changed.
  if (input.productUuid) {
    const [existing] = await db
      .select({ sku: Products.sku })
      .from(Products)
      .where(eq(Products.uuid, input.productUuid));
    if (existing?.sku && existing.sku.startsWith(`${prefix}-`)) {
      return existing.sku;
    }
  }

  // SEQ = the highest existing sequence for this prefix + 1 (collision-breaker).
  const rows = await db
    .select({ sku: Products.sku })
    .from(Products)
    .where(like(Products.sku, `${prefix}-%`));
  const used = rows
    .map((row) => Number(row.sku?.split("-").pop()))
    .filter((value) => Number.isInteger(value));
  const seq = (used.length ? Math.max(...used) : 0) + 1;

  return `${prefix}-${String(seq).padStart(2, "0")}`;
};

export const getProducts = async (
  filters: ProductFilters = {},
): Promise<ProductListItem[]> => {
  try {
    const conditions: (SQL | undefined)[] = [];
    if (filters.search) {
      const term = `%${filters.search}%`;
      // Flexible match across every field a product might be found by.
      conditions.push(
        or(
          like(Products.name, term),
          like(Products.model, term),
          like(Products.sku, term),
          like(Products.seriesCode, term),
          like(Products.shortDescription, term),
          like(Products.description, term),
          like(Brands.name, term),
          like(Categories.name, term),
        ),
      );
    }
    if (filters.categoryUuids && filters.categoryUuids.length > 0) {
      conditions.push(inArray(Products.categoryUuid, filters.categoryUuids));
    }
    if (filters.brandUuids && filters.brandUuids.length > 0) {
      conditions.push(inArray(Products.brandUuid, filters.brandUuids));
    }
    for (const [key, values] of Object.entries(filters.specValues ?? {})) {
      conditions.push(specValueCondition(key, values));
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
  } catch (error) {
    console.error("getProducts failed:", error);
    throw new Error("Failed to fetch products", { cause: error });
  }
};

// Admin list search: match the product name, SKU, or model.
const adminProductSearchFilter = (search?: string) => {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }
  return or(
    like(Products.name, `%${term}%`),
    like(Products.sku, `%${term}%`),
    like(Products.model, `%${term}%`),
  );
};

/** A searched + paginated page of products for the admin list table. */
export const getProductsPage = async (
  params: ProductListParams = {},
): Promise<PaginatedResult<ProductListItem>> => {
  const { page, pageSize, offset } = resolvePagination(
    params.page,
    params.pageSize,
  );
  const where = adminProductSearchFilter(params.search);

  try {
    const [rows, [totals]] = await Promise.all([
      db
        .select({
          ...getTableColumns(Products),
          categoryName: Categories.name,
          brandName: Brands.name,
        })
        .from(Products)
        .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
        .leftJoin(Brands, eq(Products.brandUuid, Brands.uuid))
        .where(where)
        .orderBy(asc(Products.order))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(Products).where(where),
    ]);

    return buildPaginatedResult(
      rows,
      Number(totals?.total ?? 0),
      page,
      pageSize,
    );
  } catch (error) {
    console.error("getProductsPage failed:", error);
    throw new Error("Failed to fetch products", { cause: error });
  }
};

/**
 * Create a product. The SKU is system-owned (assembled from the brand/category/
 * series codes) and the slug is derived from the name — neither comes from the
 * client. Returns the new product's uuid.
 */
export const createProduct = async (
  fields: ProductClientFields,
): Promise<string> => {
  const uuid = generateUuid();
  const [{ total }] = await db.select({ total: count() }).from(Products);
  const sku = await generateProductSku({
    brandUuid: fields.brandUuid,
    categoryUuid: fields.categoryUuid,
    seriesCode: fields.seriesCode,
  });
  await db.insert(Products).values({
    ...fields,
    // The form's values are convenience, never the authority: the server coerces
    // each one to the type its attribute declares and drops anything the reveal
    // conditions now hide. A leftover value on a hidden field would still feed
    // the engine, and nobody could see the number doing it.
    specValues: await normalizeProductValues(
      fields.categoryUuid,
      fields.specValues ?? {},
    ),
    sku,
    uuid,
    order: total,
    slug: slugify(fields.name),
  });
  return uuid;
};

export const updateProduct = async (
  uuid: string,
  fields: ProductClientFields,
): Promise<void> => {
  // Regenerate the SKU (stable when brand/category/series are unchanged).
  const sku = await generateProductSku({
    brandUuid: fields.brandUuid,
    categoryUuid: fields.categoryUuid,
    seriesCode: fields.seriesCode,
    productUuid: uuid,
  });
  await db
    .update(Products)
    .set({
      ...fields,
      specValues: await normalizeProductValues(
        fields.categoryUuid,
        fields.specValues ?? {},
      ),
      sku,
      slug: slugify(fields.name),
    })
    .where(eq(Products.uuid, uuid));
};

export const deleteProduct = async (uuid: string): Promise<void> => {
  await db.delete(Products).where(eq(Products.uuid, uuid));
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
  } catch (error) {
    console.error("getProductsByCategory failed:", error);
    throw new Error("Failed to fetch products for category", { cause: error });
  }
};

// Just enough of a product to name it in a picker. Deliberately NOT
// `ProductListItem` — a picker that dragged every column across the wire for
// every candidate is how a search box becomes the slowest thing on a page.
export type ProductPickerItem = {
  uuid: SelectProducts["uuid"];
  name: SelectProducts["name"];
  sku: SelectProducts["sku"];
  categoryName: SelectCategories["name"] | null;
};

// One query, hard-capped. The picker is a search box, not a catalog dump.
const PICKER_LIMIT = 30;

/**
 * Products matching a search term, for a picker.
 *
 * Used by the rule preview, where an author names the two or three products
 * whose combination they want to try a draft rule against.
 */
export const searchProductsForPicker = async (
  search: string,
): Promise<ProductPickerItem[]> => {
  const where = adminProductSearchFilter(search);
  try {
    return await db
      .select({
        uuid: Products.uuid,
        name: Products.name,
        sku: Products.sku,
        categoryName: Categories.name,
      })
      .from(Products)
      .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
      .where(where)
      .orderBy(asc(Products.name))
      .limit(PICKER_LIMIT);
  } catch (error) {
    console.error("searchProductsForPicker failed:", error);
    throw new Error("Failed to search products", { cause: error });
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
  } catch (error) {
    console.error("getProductsByBrand failed:", error);
    throw new Error("Failed to fetch products for brand", { cause: error });
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
  } catch (error) {
    console.error("getProduct failed:", error);
    throw new Error("Failed to fetch product", { cause: error });
  }
};

/** A product resolved by its uuid, enriched with category & brand for the admin detail page. */
export const getProductDetailByUuid = async (
  uuid: string,
): Promise<ProductDetail | null> => {
  try {
    const [product] = await db
      .select({
        ...getTableColumns(Products),
        categoryName: Categories.name,
        brandName: Brands.name,
        brandBusinessLines: Brands.businessLines,
      })
      .from(Products)
      .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
      .leftJoin(Brands, eq(Products.brandUuid, Brands.uuid))
      .where(eq(Products.uuid, uuid));

    if (!product) {
      return null;
    }

    const [category] = await db
      .select()
      .from(Categories)
      .where(eq(Categories.uuid, product.categoryUuid));

    return { ...product, category: category ?? null };
  } catch (error) {
    console.error("getProductDetailByUuid failed:", error);
    throw new Error("Failed to fetch product", { cause: error });
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
        brandBusinessLines: Brands.businessLines,
      })
      .from(Products)
      .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
      .leftJoin(Brands, eq(Products.brandUuid, Brands.uuid))
      .where(eq(Products.slug, slug));

    if (!product) {
      return null;
    }

    const [category] = await db
      .select()
      .from(Categories)
      .where(eq(Categories.uuid, product.categoryUuid));

    return { ...product, category: category ?? null };
  } catch (error) {
    console.error("getProductDetailBySlug failed:", error);
    throw new Error("Failed to fetch product", { cause: error });
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
  } catch (error) {
    console.error("getComparableProducts failed:", error);
    throw new Error("Failed to fetch comparable products", { cause: error });
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
    if (!product) {
      return [];
    }

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
  } catch (error) {
    console.error("getRelatedProducts failed:", error);
    throw new Error("Failed to fetch related products", { cause: error });
  }
};
