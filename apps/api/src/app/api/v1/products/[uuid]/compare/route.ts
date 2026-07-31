import { getViewerFromRequest } from "@/lib/helpers";
import { NextResponse } from "next/server";
import {
  getComparableProducts,
  getComparisonSpecs,
  getProductDetailByUuid,
} from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

/**
 * This product beside its comparables — one spec table across all of them.
 *
 * A separate endpoint rather than more fields on the product detail: every caller
 * pays for the detail payload, and only a caller who opened the compare view
 * needs the columns.
 *
 * The rows come from `getComparisonSpecs`, which is what the web compare table
 * uses, so the two cannot disagree about which attributes compare or in what
 * order. It is a FIXED two reads however many columns there are, and the reveal is
 * evaluated per product — a switch with PoE off has no PoE Budget cell while the
 * one beside it does.
 */
export const GET = async (request: Request, { params }: Params) => {
  const { uuid } = await params;
  const product = await getProductDetailByUuid(uuid);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const viewer = await getViewerFromRequest(request);
  const others = await getComparableProducts(product.categoryUuid, uuid);
  // The subject reads as a column like any other, first.
  const columns = [product, ...others];

  const rows = await getComparisonSpecs(
    product.categoryUuid,
    columns.map((entry) => ({
      uuid: entry.uuid,
      values: entry.specValues ?? {},
    })),
    viewer,
  );

  return NextResponse.json({
    // Only what a column header needs. The full products would carry their spec
    // values, and those have not been through the audience gate the rows have.
    products: columns.map((entry) => ({
      uuid: entry.uuid,
      name: entry.name,
      image: entry.image,
      price: entry.price,
      currency: entry.currency,
      brandName: entry.brandName,
    })),
    rows,
  });
};
