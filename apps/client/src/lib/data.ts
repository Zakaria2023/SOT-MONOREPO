import { cache } from "react";
import { getCategories } from "services";

/**
 * Request-scoped categories fetch. React's `cache` dedupes the query within a
 * single render, so the navbar (layout) and the home page share one DB call.
 */
export const getCachedCategories = cache(() => getCategories());
