import { getBrand } from "services";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const GET = async (_request: Request, { params }: Params) => {
  const { uuid } = await params;
  const brand = await getBrand(uuid);

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  return NextResponse.json(brand);
};
