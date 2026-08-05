import { getViewerFromRequest } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { facetSelectionValues, getCategoryFacets } from "services";
import { parseSpecParams } from "utils";

type Params = {
  params: Promise<{ uuid: string }>;
};

/**
 * The filters this category offers the caller — the mobile equivalent of the
 * web catalog's facet sidebar.
 *
 * Resolved server-side from the assignments, so the app never needs to know
 * about the library, the category tree, or who may see what. Each facet's
 * options are already the category's enabled slice, and `ordered` tells the
 * app to present it as "what you have" rather than an exact match.
 *
 * Resolved TWICE when the caller sends what it has already ticked, exactly as the
 * web catalog page does: the first pass gives the facets this category always
 * offers, the second re-resolves with those choices so a conditional facet appears
 * once its trigger is set — PoE Budget shows up only after PoE = Yes.
 *
 * Choices are filtered to what the first pass offered before they are used. A key
 * this category does not offer THIS viewer must not become usable by putting it in
 * the query string.
 */
export const GET = async (request: Request, { params }: Params) => {
  const { uuid } = await params;
  const { searchParams } = new URL(request.url);
  const viewer = await getViewerFromRequest(request);

  const base = await getCategoryFacets(uuid, viewer);
  const chosen = parseSpecParams(searchParams.getAll("spec"));
  if (Object.keys(chosen).length === 0) {
    return NextResponse.json(base);
  }

  const offered = new Set(base.map((facet) => facet.key));
  const permitted = Object.fromEntries(
    Object.entries(chosen).filter(([key]) => offered.has(key)),
  );
  return NextResponse.json(
    await getCategoryFacets(uuid, viewer, facetSelectionValues(permitted, base)),
  );
};
