import { getViewerFromRequest } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { getProduct, getProductSpecsForDisplay } from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const GET = async (request: Request, { params }: Params) => {
  const { uuid } = await params;
  const product = await getProduct(uuid);

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
    // The retired slug-keyed column never reaches a caller. Nothing resolves it
    // any more, so it is not audience-filtered, and spreading it would walk every
    // value it holds straight past the gate directly above. JSON omits an
    // undefined key, so this removes the field rather than nulling it.
    technicalAttributes: undefined,
    specValues,
    specs,
  });
};
