import {
  getNumberField,
  getStringField,
  getUserFromRequest,
  readBody,
  unauthorized,
} from "@/lib/helpers";
import { NextResponse } from "next/server";
import { addToCart, toErrorResponse } from "services";

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
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
};
