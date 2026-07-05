import { getProduct } from "services";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const GET = async (_request: Request, { params }: Params) => {
  const { uuid } = await params;
  const product = await getProduct(uuid);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product);
};
