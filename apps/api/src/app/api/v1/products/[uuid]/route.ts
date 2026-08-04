import { getViewerFromRequest } from "@/lib/helpers";
import { NextResponse } from "next/server";
import {
  getProductDetailByUuid,
  getProductSpecsForDisplay,
} from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const GET = async (request: Request, { params }: Params) => {
  const { uuid } = await params;
  // getProductDetailByUuid, not getProduct: the bare row carries brand_uuid and
  // category_uuid but no names, so the app was rendering a detail screen with no
  // brand and no category — the fields were declared in its DTO and never sent.
  // This is the same read the web product page and the compare endpoint use.
  const product = await getProductDetailByUuid(uuid);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Audience gates reading, not just filtering. Returning the stored values as-is
  // would hand every partner-only one to any caller, and the app has no way of
  // knowing which it was never meant to see — so the filtering happens here, not
  // in the client.
  const viewer = await getViewerFromRequest(request);
  // Already resolved, revealed, audience-filtered and FORMATTED — the app gets a
  // spec table it can render without carrying its own copy of the library, and
  // without ever seeing a value it was not meant to.
  const specs = await getProductSpecsForDisplay(
    product.categoryUuid,
    product.specValues ?? {},
    viewer,
  );

  const visible = new Set(specs.map((spec) => spec.uuid));
  const specValues = Object.fromEntries(
    Object.entries(product.specValues ?? {}).filter(([uuid]) =>
      visible.has(uuid),
    ),
  );

  return NextResponse.json({
    ...product,
    specValues,
    specs,
  });
};
