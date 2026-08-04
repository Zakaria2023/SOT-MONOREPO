import { NextResponse } from "next/server";
import { getRelatedProducts } from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

/**
 * The "pairs well with" list the web product page shows, for the app.
 *
 * Same service, so the two surfaces cannot recommend different things for the same
 * product. Its own endpoint rather than more fields on the detail payload: the
 * catalogue grid and the cart both read a product and neither needs six more of
 * them attached.
 *
 * No audience gate here because there is nothing to gate — these are list items
 * (name, price, image), and `getRelatedProducts` leaves spec values out of them
 * entirely. An unknown uuid comes back as an empty list rather than a 404: a
 * product with no siblings and a product that does not exist look the same to a
 * section that simply renders nothing.
 */
export const GET = async (_request: Request, { params }: Params) => {
  const { uuid } = await params;
  const related = await getRelatedProducts(uuid);
  return NextResponse.json(related);
};
