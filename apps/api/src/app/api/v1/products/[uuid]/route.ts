import { getViewerFromRequest } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { getProduct, getProductDisplaySpecs } from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const GET = async (request: Request, { params }: Params) => {
  const { uuid } = await params;
  const product = await getProduct(uuid);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Audience gates reading, not just filtering. Returning technicalAttributes
  // as stored would hand every partner-only value to any caller, and the app
  // has no way of knowing which ones it was never meant to see — so the
  // filtering happens here, not in the client.
  const viewer = await getViewerFromRequest(request);
  const storedKeys =
    product.specKeys ?? Object.keys(product.technicalAttributes ?? {});
  const specs = await getProductDisplaySpecs(
    product.categoryUuid,
    storedKeys,
    viewer,
  );

  const visible = new Set(specs.map((spec) => spec.key));
  const technicalAttributes = Object.fromEntries(
    Object.entries(product.technicalAttributes ?? {}).filter(([key]) =>
      visible.has(key),
    ),
  );

  return NextResponse.json({
    ...product,
    technicalAttributes,
    specKeys: storedKeys.filter((key) => visible.has(key)),
    // Resolved label/unit/group per key, so the app can render a spec table
    // without carrying its own copy of the library.
    specs,
  });
};
