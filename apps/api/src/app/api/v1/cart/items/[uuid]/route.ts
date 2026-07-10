import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { getNumberField, readBody } from "@/lib/request";
import { NextResponse } from "next/server";
import { removeCartItem, updateCartItemQuantity } from "services";

type Params = {
  params: Promise<{ uuid: string }>;
};

export const PATCH = async (request: Request, { params }: Params) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const quantity = getNumberField(await readBody(request), "quantity");
  if (quantity === null) {
    return NextResponse.json({ error: "quantity is required" }, { status: 400 });
  }

  const { uuid } = await params;
  try {
    await updateCartItemQuantity({
      userUuid: user.uuid,
      cartItemUuid: uuid,
      quantity,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update cart item",
      },
      { status: 400 },
    );
  }
};

export const DELETE = async (request: Request, { params }: Params) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const { uuid } = await params;
  await removeCartItem({ userUuid: user.uuid, cartItemUuid: uuid });
  return new NextResponse(null, { status: 204 });
};
