import { getCategory } from "services";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const GET = async (_request: Request, { params }: Params) => {
  const { uuid } = await params;
  const category = await getCategory(uuid);

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json(category);
};
