import { getBrands } from "services";
import { NextResponse } from "next/server";

export const GET = async () => {
  const brands = await getBrands();

  return NextResponse.json(brands);
};
