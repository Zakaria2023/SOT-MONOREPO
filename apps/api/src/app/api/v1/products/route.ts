import { getViewerFromRequest } from "@/lib/helpers";
import { NextResponse } from "next/server";
import {
  expandFacetChoices,
  getCategoryFacets,
  getProducts,
  type ProductSort,
} from "services";
import { parseSpecParams, parseSpecRangeParams } from "utils";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const categoryUuids = searchParams.getAll("category");
  const brandUuids = searchParams.getAll("brand");
  const sort = searchParams.get("sort") ?? undefined;

  // Spec facets arrive as repeated `spec=key:value` — the same encoding the
  // web catalog puts in its URL, so a link shared between the two means the
  // same thing on both.
  const chosen = parseSpecParams(searchParams.getAll("spec"));
  // Numeric facets travel separately: they are bounds, not values to match.
  const ranges = parseSpecRangeParams(searchParams.getAll("range"));

  // A facet belongs to a place in the tree, so the spec params have to say
  // WHICH category they came from. `facets` names it explicitly, because
  // `category` is usually a whole subtree — picking "Networking" has to match
  // products sitting in its leaves, while the facets are Networking's.
  const facetCategory =
    searchParams.get("facets") ??
    (categoryUuids.length === 1 ? categoryUuids[0] : null);

  const asked =
    Object.keys(chosen).length > 0 || Object.keys(ranges).length > 0;

  let specValues: Record<string, string[]> = {};
  let specRanges: Record<string, { min?: number; max?: number }> = {};
  if (asked && facetCategory) {
    const viewer = await getViewerFromRequest(request);
    const facets = await getCategoryFacets(facetCategory, viewer);
    const offered = new Set(facets.map((facet) => facet.key));
    // Anything this category doesn't offer THIS viewer is dropped: a stale key
    // must not filter every product away, and a partner-only facet must not
    // become usable just by putting it in the query string. Bounds are held to
    // the same rule — a range narrows the list, so an ungated one would let a
    // caller probe an attribute they may not read.
    const permitted = Object.fromEntries(
      Object.entries(chosen).filter(([key]) => offered.has(key)),
    );
    // An ordered facet is a ceiling, not an exact match.
    specValues = expandFacetChoices(facets, permitted);
    specRanges = Object.fromEntries(
      Object.entries(ranges).filter(([key]) => offered.has(key)),
    );
  }

  const products = await getProducts({
    search,
    categoryUuids: categoryUuids.length > 0 ? categoryUuids : undefined,
    brandUuids: brandUuids.length > 0 ? brandUuids : undefined,
    specValues,
    specRanges: Object.keys(specRanges).length > 0 ? specRanges : undefined,
    sort: sort as ProductSort | undefined,
  });

  return NextResponse.json(products);
};
