import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
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
  type ListParams,
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
import { ValidationError } from "./errors";
import { normalizeProductValues } from "./product-completeness";

export type { SelectProducts };

export type ProductListItem = SelectProducts & {
  categoryName: SelectCategories["name"] | null;
  brandName: SelectBrands["name"] | null;
};

/**
 * A product as a list or card renders it.
 *
 * `specValues` and `equivalents` are left out: both are JSON payloads that only a
 * detail view, the compare table or the rules engine ever opens, and getProducts
 * feeds the catalog grid, the home page and the navbar mega-menu. Dragging a
 * per-product attribute map across the wire for a card showing a name and a price
 * is the whole cost of `getTableColumns`.
 *
 * Omitted rather than typed-as-present-but-absent on purpose. A type that claims
 * specValues is there while the query never selected it is the kind of lie that
 * surfaces as `undefined` somewhere far away.
 */
export type ProductSummary = Omit<
  ProductListItem,
  "specValues" | "equivalents"
>;

// Everything a summary needs, named once. `description` and `images` stay because
// the mobile /products contract includes them.
const productSummaryColumns = () => {
  const {
    specValues: _specValues,
    equivalents: _equivalents,
    ...columns
  } = getTableColumns(Products);
  return columns;
};

export type ProductFields = Omit<
  InsertProducts,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

// The client form never sets the slug — it's derived from the name on save.
export type ProductClientFields = Omit<ProductFields, "slug">;

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
  /**
   * Numeric facets, as bounds rather than values to match. A `number` attribute
   * marked as a filter has no option list — "48 ports or more" is the only
   * question worth asking of it.
   */
  specRanges?: Record<string, { min?: number; max?: number }>;
  /** Page size. Omitted, the query returns every match. */
  limit?: number;
  /** Rows to skip — `(page - 1) * limit`. Only read when `limit` is set. */
  offset?: number;
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

/**
 * Match one numeric spec against a product's `specValues` JSON.
 *
 * The stored value is a JSON number, so it is unquoted out of the document and
 * cast before comparing — `json_extract` alone compares as JSON, where 9 sorts
 * after 48 because it compares them as text.
 *
 * A product with no value for the attribute drops out, which is the honest
 * answer: "48 ports or more" cannot include a switch whose port count nobody has
 * recorded.
 */
const specRangeCondition = (
  attrUuid: string,
  range: { min?: number; max?: number },
): SQL | undefined => {
  const bounds: SQL[] = [];
  const path = `$."${attrUuid}"`;
  const value = sql`cast(json_unquote(json_extract(${Products.specValues}, ${path})) as decimal(20, 4))`;
  if (range.min !== undefined) {
    bounds.push(sql`${value} >= ${range.min}`);
  }
  if (range.max !== undefined) {
    bounds.push(sql`${value} <= ${range.max}`);
  }
  return bounds.length > 0 ? and(...bounds) : undefined;
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

/**
 * The WHERE for a catalogue query, built once and used by both the page of rows
 * and its count. Two copies of this would eventually disagree, and the symptom —
 * a total that does not match the list under it — is the kind a shopper notices
 * long before we do.
 */
const catalogConditions = (filters: ProductFilters): (SQL | undefined)[] => {
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
  for (const [key, range] of Object.entries(filters.specRanges ?? {})) {
    conditions.push(specRangeCondition(key, range));
  }
  return conditions;
};

export const getProducts = async (
  filters: ProductFilters = {},
): Promise<ProductSummary[]> => {
  try {
    const conditions = catalogConditions(filters);

    const query = db
      .select({
        ...productSummaryColumns(),
        categoryName: Categories.name,
        brandName: Brands.name,
      })
      .from(Products)
      .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
      .leftJoin(Brands, eq(Products.brandUuid, Brands.uuid))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(...productOrder(filters.sort))
      .$dynamic();

    // Paged in SQL, not sliced after the fact: a catalogue page asking for nine
    // products should not drag every matching row across the wire to throw all
    // but nine of them away.
    if (filters.limit !== undefined) {
      query.limit(filters.limit).offset(filters.offset ?? 0);
    }

    return await query;
  } catch (error) {
    console.error("getProducts failed:", error);
    throw new Error("Failed to fetch products", { cause: error });
  }
};

/**
 * How many products match, ignoring limit and offset.
 *
 * Its own query because a paged SELECT cannot also report the size of what it
 * paged. Run it beside getProducts, never after: they share no data and the round
 * trip to the database is the whole cost.
 */
export const countProducts = async (
  filters: ProductFilters = {},
): Promise<number> => {
  try {
    const conditions = catalogConditions(filters);
    const [row] = await db
      .select({ total: sql<number>`count(*)` })
      .from(Products)
      .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
      .leftJoin(Brands, eq(Products.brandUuid, Brands.uuid))
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return Number(row?.total ?? 0);
  } catch (error) {
    console.error("countProducts failed:", error);
    throw new Error("Failed to count products", { cause: error });
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

/** What the admin list can narrow by, beyond the search box and the page. */
export type AdminProductFilters = ListParams & {
  /** Exactly this category, not its subtree: the admin is looking at rows. */
  categoryUuid?: string;
  brandUuid?: string;
};

/** A searched + filtered + paginated page of products for the admin list. */
export const getProductsPage = async (
  params: AdminProductFilters = {},
): Promise<PaginatedResult<ProductListItem>> => {
  const { page, pageSize, offset } = resolvePagination(
    params.page,
    params.pageSize,
  );
  const where = and(
    adminProductSearchFilter(params.search),
    params.categoryUuid
      ? eq(Products.categoryUuid, params.categoryUuid)
      : undefined,
    params.brandUuid ? eq(Products.brandUuid, params.brandUuid) : undefined,
  );

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
 * Refuse a second row claiming an identity that already exists.
 *
 * A PRODUCT IS brand + model + variant. Not its name, and above all not its
 * slug: vendors reuse one slug across a whole variant family — 86 of Ajax's 290
 * products share a slug with a sibling — so an import keyed on the slug lets
 * those 86 overwrite each other with nothing raised. The first parse came back
 * with 204 products and every missing one looked like a page that had simply not
 * been harvested.
 *
 * The unique index enforces this whatever route the write came in by. This exists
 * so the author gets a sentence naming the product they collided with, instead of
 * a driver error naming a constraint.
 *
 * A product with no model is left alone. Rows entered before identity was
 * claimable carry none, and MySQL treats those NULLs as distinct — refusing them
 * would turn a schema addition into a migration nobody can run.
 */
const assertIdentityIsFree = async (
  fields: Pick<ProductClientFields, "brandUuid" | "model" | "variant">,
  // Absent when creating. Present when updating, so a product does not collide
  // with the row it already is.
  selfUuid?: string,
): Promise<void> => {
  const model = fields.model?.trim() || null;
  if (!model) {
    return;
  }
  const variant = fields.variant?.trim() || null;
  const [clash] = await db
    .select({ uuid: Products.uuid, name: Products.name })
    .from(Products)
    .where(
      and(
        eq(Products.brandUuid, fields.brandUuid),
        eq(Products.model, model),
        variant === null
          ? isNull(Products.variant)
          : eq(Products.variant, variant),
      ),
    )
    .limit(1);

  if (clash && clash.uuid !== selfUuid) {
    throw new ValidationError(
      variant
        ? `"${clash.name}" is already this brand's ${model} ${variant}. Two rows for one variant is how a product silently overwrites its sibling — give this one the variant that tells them apart.`
        : `"${clash.name}" is already this brand's ${model}. If these are two variants of it, name the variant on each — otherwise one will overwrite the other on the next import.`,
    );
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

  await assertIdentityIsFree(fields);

  // The row count, the SKU and the normalized values are independent of one
  // another — only the insert needs all three — so they go out together
  // instead of in three serial waits.
  const [[{ total }], sku, specValues] = await Promise.all([
    db.select({ total: count() }).from(Products),
    generateProductSku({
      brandUuid: fields.brandUuid,
      categoryUuid: fields.categoryUuid,
      seriesCode: fields.seriesCode,
    }),
    // The form's values are convenience, never the authority: the server coerces
    // each one to the type its attribute declares and drops anything the reveal
    // conditions now hide. A leftover value on a hidden field would still feed
    // the engine, and nobody could see the number doing it.
    normalizeProductValues(fields.categoryUuid, fields.specValues ?? {}),
  ]);

  await db.insert(Products).values({
    ...fields,
    specValues,
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
  await assertIdentityIsFree(fields, uuid);

  // Regenerating the SKU (stable when brand/category/series are unchanged) and
  // normalizing the values are independent — only the update needs both.
  const [sku, specValues] = await Promise.all([
    generateProductSku({
      brandUuid: fields.brandUuid,
      categoryUuid: fields.categoryUuid,
      seriesCode: fields.seriesCode,
      productUuid: uuid,
    }),
    normalizeProductValues(fields.categoryUuid, fields.specValues ?? {}),
  ]);

  await db
    .update(Products)
    .set({
      ...fields,
      specValues,
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
