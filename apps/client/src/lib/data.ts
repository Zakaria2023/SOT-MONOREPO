import { cache } from "react";
import {
  getBrand,
  getBrands,
  getCategories,
  getCategory,
  getProductDetailBySlug,
  getProducts,
  type Viewer,
} from "services";

/**
 * Request-scoped categories fetch. React's `cache` dedupes the query within a
 * single render, so the navbar (layout) and the home page share one DB call.
 */
export const getCachedCategories = cache(() => getCategories());

/**
 * Request-scoped products fetch, shared by the navbar mega-menu and the home
 * page's product grid.
 *
 * The viewer is a parameter rather than resolved inside, because `cache` keys on
 * the arguments: resolved inside, a partner and a guest rendering in the same
 * request scope would share whichever list was fetched first.
 */
export const getCachedProducts = cache((viewer: Viewer) =>
  getProducts({ viewer }),
);

/** Request-scoped brands fetch, for the pages that list and filter by them. */
export const getCachedBrands = cache(() => getBrands());

/**
 * The detail reads below exist because `generateMetadata` and the page body
 * both need the same row. Next runs them in one request scope, so `cache`
 * collapses the pair into a single query — without it every detail page would
 * cost two, against a connection pool all the apps share.
 */
export const getCachedProductBySlug = cache((slug: string) =>
  getProductDetailBySlug(slug),
);

export const getCachedCategory = cache((uuid: string) => getCategory(uuid));

export const getCachedBrand = cache((uuid: string) => getBrand(uuid));
