import { getViewerFromRequest } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { getCategoryFacets } from "services";

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
 */
export const GET = async (request: Request, { params }: Params) => {
  const { uuid } = await params;
  const viewer = await getViewerFromRequest(request);
  return NextResponse.json(await getCategoryFacets(uuid, viewer));
};
