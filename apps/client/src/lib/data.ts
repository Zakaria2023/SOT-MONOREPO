import { cache } from "react";
import { getCategories, getProducts } from "services";

/**
 * Request-scoped categories fetch. React's `cache` dedupes the query within a
 * single render, so the navbar (layout) and the home page share one DB call.
 */
export const getCachedCategories = cache(() => getCategories());

/**
 * Request-scoped products fetch, shared by the navbar mega-menu and the home
 * page's product grid.
 */
export const getCachedProducts = cache(() => getProducts());
