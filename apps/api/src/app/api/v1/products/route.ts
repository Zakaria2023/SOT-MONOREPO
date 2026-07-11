import { getProducts, type ProductSort } from "services";
import { NextResponse } from "next/server";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const categoryUuids = searchParams.getAll("category");
  const brandUuids = searchParams.getAll("brand");
  const sort = searchParams.get("sort") ?? undefined;

  const products = await getProducts({
    search,
    categoryUuids: categoryUuids.length > 0 ? categoryUuids : undefined,
    brandUuids: brandUuids.length > 0 ? brandUuids : undefined,
    sort: sort as ProductSort | undefined,
  });

  return NextResponse.json(products);
};
