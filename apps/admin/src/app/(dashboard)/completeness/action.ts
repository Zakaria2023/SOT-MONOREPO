"use server";

import { getCatalogCompleteness } from "services";
import type {
  CompletenessProblem as ServiceCompletenessProblem,
  ProductCompleteness as ServiceProductCompleteness,
} from "services";

// A "use server" file may only export async functions; types are re-declared as
// local aliases so consumers can keep importing them from here.
export type ProductCompleteness = ServiceProductCompleteness;
export type CompletenessProblem = ServiceCompletenessProblem;

/**
 * Every product's spec-data problems, in ONE pass.
 *
 * Deliberately not paginated and deliberately not two calls. Completeness is
 * computed in memory from each product's values — no WHERE clause can express
 * "incomplete" — so any honest answer reads every product once. Reading a page at
 * a time would report "no problems" from a sample, and a health screen that says
 * nothing is wrong because it only looked at forty products is the same silent
 * approval this whole module exists to prevent.
 *
 * The per-category rollup is derived from this same array rather than calling
 * `getCompletenessByCategory`, which would repeat the scan.
 */
export const getCompleteness = async (): Promise<ProductCompleteness[]> =>
  getCatalogCompleteness();
