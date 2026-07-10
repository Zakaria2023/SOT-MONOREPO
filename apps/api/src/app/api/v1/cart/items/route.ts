import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { getNumberField, getStringField, readBody } from "@/lib/request";
import { NextResponse } from "next/server";
import { addToCart } from "services";

export const POST = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const body = await readBody(request);
  const productUuid = getStringField(body, "productUuid");
  if (!productUuid) {
    return NextResponse.json(
      { error: "productUuid is required" },
      { status: 400 },
    );
  }
  const quantity = getNumberField(body, "quantity");

  try {
    const item = await addToCart({
      userUuid: user.uuid,
      productUuid,
      ...(quantity === null ? {} : { quantity }),
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add to cart",
      },
      { status: 400 },
    );
  }
};
