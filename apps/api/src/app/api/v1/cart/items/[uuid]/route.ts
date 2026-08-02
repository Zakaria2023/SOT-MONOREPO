import {
  getNumberField,
  getUserFromRequest,
  readBody,
  unauthorized,
} from "@/lib/helpers";
import { NextResponse } from "next/server";
import {
  removeCartItem,
  toErrorResponse,
  updateCartItemQuantity,
} from "services";

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
    return NextResponse.json(
      { error: "quantity is required" },
      { status: 400 },
    );
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
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
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
